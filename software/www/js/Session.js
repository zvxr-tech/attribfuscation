/*
Attribfuscator - Session Controller (shape-colour-colour implementation)
Mike Clark - 2017

Session Controller is for automating the administration of the POC in a study setting.
This class interacts with the system via the Controller control handlers. (I.e. to get a new challenge, it would trigger the appropriate
handler in Controller as if the user clicked that button.)
It will control when the challenges and secrets presented. It can load different implementations
(I.e. colour-shape, numeric, numeric scrambled) and use a timer or playcounts (wins, losses, total) to set length of engagement.
It can make use of the telemetry handles exposed and stockpile multiple data buffers. It also has the capability to write out
the data over a network connection.

Data Registers to hold win/loss statistics (total counts and current consecutive run of wins or losses)
Total: 		REG_TY_TOT = 0;
Win Count: 	REG_TY_ACK = 1;
Win Run: 	REG_TY_ACK_RUN = 2;
Loss Count: REG_TY_NAK = 3;
Loss Run: 	REG_TY_NAK_RUN = 4;
*/



class Stack {
	
	constructor(sz=256) {
		this.sz = sz;
		this.index = 0;
		this.buffer = new Array(this.sz);
	}

	push(element) {
		if (this.index < this.sz) {
			this.buffer[this.index++] = element;
			return element;
		}
		return undefined;
	}

	pop(cnt) {
		var arr = new Array(cnt);
		var i = 0;
		while (i < cnt) {
			if (this.index <= 0) return undefined; // leave here to make debugging easier
			arr[i++] = this.buffer[--this.index];
			this.buffer[this.index] = undefined;
		}
		return arr;
	}
}

/* The Condition class represents a set of conditions, this can be timer-based
or (arithmentic/logical) equations that reference registers exposed by the
Session class, such as win count, loss count -- see formats.txt. 
*/
class Condition {
	constructor(timerDurationParam, isStrictParam, expressionParam) {
		this.timerDuration = timerDurationParam; // timer off if zero
		this.isStrict = isStrictParam; // unused
		this.expression = expressionParam;

		this.evaluate = function (register) {
				var stack = new Stack(256);
				this.expression.split(',').forEach(function (element) {
					var val;
					var ops;
					switch(element[0]) {
						case '+':
							ops = stack.pop(2);
							stack.push(ops[1] + ops[0]);
							break;
						case '-':
							ops = stack.pop(2);
							stack.push(ops[1] - ops[0]);
							break;
						case '*':
							ops = stack.pop(2);
							stack.push(ops[1] * ops[0]);
							break;
						case '/':
							ops = stack.pop(2);
							stack.push(ops[1] / ops[0]);
							break;
						case '<':
							ops = stack.pop(2);
							stack.push((ops[1] < ops[0]) ? 1 : 0);
							break;
						case '>':
							ops = stack.pop(2);
							stack.push((ops[1] > ops[0]) ? 1 : 0);
							break;
						case '=':
							ops = stack.pop(2);
							stack.push((ops[1] == ops[0]) ? 1 : 0);
							break;
						case '&':
							ops = stack.pop(2);
							stack.push((ops[1] && ops[0]) ? 1 : 0);
							break;
						case '|':
							ops = stack.pop(2);
							stack.push((ops[1] || ops[0]) ? 1 : 0);
							break;
						case '!':
							ops = stack.pop(1);
							stack.push((!ops[0]) ? 1 : 0);
							break;
						case '_':
							var index = parseInt(element.slice(1));
							val = register[index];
							// we re-use the defaul case below for numeric tokens, to test that the underscore is followed by a number.
						default:
							if ('0' <= element[0] && element[0] <= '9') {
								val = parseInt(element);
							} else if (element[0] != '_') {
								fatalError('Unknown token encountered "' + element[0] + '"');
								return false;
							}

							stack.push(val)
							break;
					}
				});
				var ret = stack.pop(1)[0];
				return ret;
		}
	}
}

/* This represents a section. A study session is composed of sections (E.g. Consent form, instruction pages, evaluation phases, surveys with arbitrary data. */
class Section {
	constructor (sectionIdParam, systemTypeParam, telemetryParam, challengeModeParam, preludeStrParam, htmlParam, newChallengeConditionParam, newSecretConditionParam, endConditionParam) {
		this.sid = sectionIdParam;
		this.systemType = systemTypeParam;
		this.telemetry = telemetryParam;
		this.challengeMode = challengeModeParam;
		this.preludeStr = preludeStrParam;
		this.html = htmlParam;
		this.newChallengeCondition = newChallengeConditionParam
		this.newSecretCondition = newSecretConditionParam;
		this.endCondition = endConditionParam;
	}
}

function Session() {
	/*******************************************************************************
	 "CONSTANTS"
	*******************************************************************************/
	var _that = this;

	var REG_TY_TOT = 0;
	var REG_TY_ACK = 1;
	var REG_TY_ACK_RUN = 2;
	var REG_TY_NAK = 3;
	var REG_TY_NAK_RUN = 4;
	var REG_TY_COUNT = 5; //anchor for counting
	
	var rxNotNumeric = new RegExp('[^0-9]');
	
	var version = 1;
	/*******************************************************************************
	 CONSTRUCTOR / PRIVATE MEMEBERS
	*******************************************************************************/
	var controller; 
	var ssid; // session id declared in constructor
	
	var dataOutput;
	var sectionList = new Array();
	var sectionIndex = 0;
	var currentSection;


	
	var bufferStore = new Array();	
	var docRoot = document;

	var register = new Array(REG_TY_COUNT);
	register.fill(0);
	

	var newChallengeTimer;
	var newSecretTimer;
	var endTimer;

	var that = this;
	/*******************************************************************************
	 PRIVILEGED
	*******************************************************************************/
	this.interrupt = function(ino) {
		switch (ino) {
			case INO_SUBMIT_ACK:
				register[REG_TY_ACK]++;
				register[REG_TY_NAK_RUN] = 0;
				register[REG_TY_ACK_RUN]++;
			break;
			case INO_SUBMIT_NAK:
				register[REG_TY_NAK]++;
				register[REG_TY_NAK_RUN]++;
				register[REG_TY_ACK_RUN] = 0;
			break;
			case INO_TIMER:
				if (currentSection.endCondition.timerDuration > 0) {
					endTimer = setTimeout(endTimerHandler, currentSection.endCondition.timerDuration * 1000);
				}

				if (currentSection.newSecretCondition.timerDuration > 0) {
					newSecretTimer = setTimeout(secretTimerHandler, currentSection.newSecretCondition.timerDuration * 1000);
				}

				if (currentSection.newChallengeCondition.timerDuration > 0) {
					newChallengeTimer = setTimeout(challengeTimerHandler, currentSection.newChallengeCondition.timerDuration * 1000);
				}
				return;
			break;
			case INO_EXIT:
				endTimers();
				setupNextSection();
				return;
				break;
			default:
				fatalError('Invalid interrupt number');
			break;
		}
		register[REG_TY_TOT]++;

		if (currentSection.endCondition.timerDuration < 1) {
			if (currentSection.endCondition.evaluate(register)) {
				endTimers()
				setupNextSection();
				return;
			}
		}
		if (currentSection.newSecretCondition.timerDuration < 1) {
			if (currentSection.newSecretCondition.evaluate(register)) {
				controller.setRandomSecretClickHandler();
				controller.saveSecretClickHandler(new Event('click'));
			}
		}
		if (currentSection.newChallengeCondition.timerDuration < 1) {
			if (currentSection.newChallengeCondition.evaluate(register)) {
				controller.newChallengeClickHandler(new Event('click'));
			}
		}
	}

	/*******************************************************************************
	 PRIVATE
	*******************************************************************************/
	function endTimers() {
		clearTimeout(endTimer);
		clearTimeout(newSecretTimer);
		clearTimeout(newChallengeTimer);
	}

	function endTimerHandler() {
		if (currentSection.endCondition.evaluate(register)) {
			endTimers();
			setupNextSection();
			return;
		} else {
			setTimeout(endTimerHandler, currentSection.endCondition.timerDuration * 1000);	
		}
	}

	function secretTimerHandler() {
		if (currentSection.newSecretCondition.evaluate(register)) {
			controller.setRandomSecretClickHandler(new Event('click'));
		} else {
			setTimeout(secretTimerHandler, currentSection.newSecretCondition.timerDuration * 1000);	
		}
	}

	function challengeTimerHandler() {
		if (currentSection.newChallengeCondition.evaluate(register)) {
			controller.newChallengeClickHandler(new Event('click'));
		} else {
			setTimeout(challengeTimerHandler, currentSection.newChallengeCondition.timerDuration * 1000);	
		}
	}


	function swapHTML(str) {
		var parser = new DOMParser();
		//parseFromString will automatically append some DOM objects, so we need to navigate back to the root <div> tag of the htm file lodaded
		var src = parser.parseFromString(str, 'text/html').children[0].lastChild.children[0]; 
		var dst = docRoot.body.children[docRoot.body.children.length - 1];
		var replacedNode = docRoot.body.replaceChild(src, dst);
	}

	/* See formats.txt for specifications */
	function setupNextSection() {
		controller.shutdown.then(() => {
		  	// successMessage is whatever we passed in the resolve(...) function above.
		  	// It doesn't have to be a string, but if it is only a succeed message, it probably will be.
		  	console.log('controller shutdown acknowledged.'); 
		  	// capture buffers
		  	if (currentSection.telemetry) {
				//var bufs = controller.telemeter.exportData();
		  		var bufs = controller.exportTelemetryData(); // [[tele_type_const,tele_buffer],[action_type_const, action_buffer], [event_type_const, event_buffer]]
				
				// the manifest parser has already bounds checked sid and register length
		  		var finalBuf = new Uint16Array([controller.exportTelemetryVersion(), 0]).concat([currentSection.sid]);


		  		// REGISTERS
		  		finalBuf = finalBuf.concat([register.length & 0xFFFF, register.length & 0xFFFF0000]);		  		
		  		finalBuf = finalBuf.concat(register); // register is already an array


		  		// TOTAL BUFFER LENGTH
		  		if (bufs.length  < 0 || bufs.length > 4294967295) {
		  			fatalError('buffer count exceeds length descriptor 4bytewidth.');
		  			return null;
		  		}
		  		finalBuf = finalBuf.concat([bufs.length & 0xFFFF, bufs.length & 0xFFFF0000]);
		  		
		  		// BUFFERS
		  		for (i = 0; i < bufs.length; i++) {  			
		  			if (bufs[i][1].length  < 0 || bufs[i][1].length > 4294967295) {
		  				fatalError('buffer length exceeds length descriptor 4bytewidth.');
		  				return null;
		  			}
		  			// type,len,buf
		  			finalBuf = finalBuf.concat([bufs[i][0], bufs[i][1].length & 0xFFFF, bufs[i][1].length & 0xFFFF0000]).concat(bufs[i][1]);
		  		}

		  		if (finalBuf) {
		  			bufferStore.push(finalBuf);
		  		}
		  	}
		  	controller.cleanup();
		  	controller = null;
			swapHTML('<div></div>')
			runSection();
		});
	}

	function runSection() {
		// anything created by the previous section, should have been cleaned up before this was invoked
		register.fill(0)
		if (sectionIndex < sectionList.length) {
			currentSection = sectionList[sectionIndex++];
			swapHTML(currentSection.html);
			//sleep(5000); // sleep to give the new node in the document time to load
			alert(currentSection.preludeStr);

			// FUTURE: parameterize some of the arguments and include in the manifest?
			if (currentSection.systemType == 'grid') { 
				controller = new Controller(docRoot,
					3,
					9,
					currentSection.systemType, currentSection.challengeMode,
					3, 3,
					100, 100,
					4,  1,
					75, 75,
					4, 3,
					75, 75,
					4, 1,
					75, 75,
					4, 4,
					_that.interrupt, currentSection.telemetry); 
			} else if (currentSection.systemType == 'grid-numeric') { 
				controller = new Controller(docRoot,
					1,
					9,
					currentSection.systemType, currentSection.challengeMode,
					3, 3,
					100, 100,
					4,  1,
					75, 75,
					4, 3,
					75, 75,
					4, 1,
					75, 75,
					4, 4,
					_that.interrupt, currentSection.telemetry); 
			} else if (currentSection.systemType == 'other'){
				controller = new Controller(docRoot,
					3,
					9,
					currentSection.systemType, currentSection.challengeMode,
					3, 3,
					100, 100,
					4,  1,
					75, 75,
					4, 3,
					75, 75,
					4, 1,
					75, 75,
					4, 4,
					_that.interrupt, currentSection.telemetry); 
			} else {
				fatalError('Unknown uiType');
			}
			
			// this routine might be on the call chain of a context other than this object, so we use a class variable that (that==this)
			that.interrupt(INO_TIMER); 

		} else {
			// we have run all the sections, save any buffers if telemetry is set
			switch(dataOutput) {
				case 'none':
				break;
				case 'local':
					console.error('WARNING: local dataOutput not supported.');
				case 'remote':
					// construct xhr from blob and send to server
					var xhr = new XMLHttpRequest;
					xhr.open('POST', 'dataMuncher.php', true); //async
					xhr.onerror = function (e) {
						fatalError('Could not transmit data. (' + e + ')');
					}
					xhr.onreadystatechange = function(e) {
      					if (this.readyState === 4) {
      						//transfer complete
							swapHTML('<div><center><large>The data is finished uploading.<br />It is now safe to close the webpage.<br />Thank you for your participation in this study.</large></center></div><script type="text/javascript>window.onbeforeunload = null;</script>');
      					}
      				}

					if (bufferStore.length < 0 || bufferStore.length > 4294967296) {
						fatalError('bufferStore length exceeds 4byte width.');
					}
					var flatBuffer = new Uint16Array([version, 0, ssid, bufferStore.length & 0xFFFF, bufferStore.length & 0xFFFF0000]);

					for (var i = 0; i < bufferStore.length; i++) {
						flatBuffer = flatBuffer.concat(bufferStore[i]);
					}
    				swapHTML('<div><center><large>The data is being uploaded. Please wait.</large></center></div>');
    				
					xhr.send(flatBuffer);
				break;
				default:
					fatalError('unknown data output type');
				break;
			}
		}
	}

	/*

		Returns null on error.
	*/
	function parseManifest(manifest) {
		var lines = manifest
		var i = 0;
		var targetVersion = parseInt(lines[i++]); 
		if (targetVersion != version || version < targetVersion) {
			fatalError('version mismatch! Session version "' + version + '". Target version "'+ targetVersion+'".');
			return null;
		}

		/*!!! this is setting a class variable, not a local one. DO NOT prefix ssid with var/let !!!*/
		ssid = lines[i++];
		if (ssid < 0 || ssid > 65535) {
			fatalError('session id exceeds 2byte width.');
			return null;
		}

		/*!!! this is setting a class variable, not a local one. DO NOT prefix dataOutput with var/let !!!*/
		dataOutput = lines[i++];
		switch(dataOutput) {
			case 'none':
			case 'local':
			case 'remote':
			break;
			default:
				fatalError('unknown data output');
				return null;
			break;
		}


		// load session sections		
		while (i + MANIFEST_SECTION_LEN <= lines.length) { 
			// section id
			var sectionId = lines[i++];
			if (sectionId < 0 || sectionId > 65535) {
		  			fatalError('section id exceeds 2byte width.');
		  			return null;
		  	}


			// SYSTEM_TYPE
			var systemType = lines[i++];
			switch(systemType) {
				case 'grid':
				break;
				case 'grid-numeric':
				break;
				case 'other':
				break;
				default:
					fatalError('Illegal system type value')
					return null;
				break;
			}

			// TELEMETRY
			var telemetry = lines[i++];
			if (telemetry == 'on' ) 
				telemetry = 1 
			else if(telemetry == 'off')
				telemetry = 0 
			else {
				 fatalError('Illegal telemetry value');
				 return null;
			}

			// CHALLENGE MODE
			var challengeMode = lines[i++];
			switch (challengeMode) {
				case 'static':
					challengeMode = 'challengeModeIdentity';
					break;
				case 'random':
					challengeMode = 'challengeModeRandom';
					break;
				default:
					fatalError('Illegal system type value')
					return null;
				break;
			}

			var preludeStr = lines[i++];

			var html = lines[i++]; // html should be stripped of newlines

			//CONDITIONS
			var newChallengeCondition = parseCondition(lines[i++]);
			var newSecretCondition = parseCondition(lines[i++]);
			var endCondition = parseCondition(lines[i++]);
			if (!(newChallengeCondition && newSecretCondition && endCondition)) {
				return null;
			}

			sectionList.push(new Section(sectionId, systemType, telemetry, challengeMode, preludeStr, html, newChallengeCondition, newSecretCondition, endCondition));
		}
		if (i != lines.length) {
			fatalError((lines.length - i) + ' lines in the tail skipped.');
			return null;
		}

		return sectionList;
	}

	function parseCondition(line) {
			var timerDuration;
			var isStrict;
			var expression
			var index = 0;

			
			
			// TIMER
			if (line[index] == 'T') {
				rxNotNumeric = new RegExp('[^0-9]');
				var timeStartIndex = index + 1;
				var timeEndIndex = line.slice(index + 1).search(rxNotNumeric);
				if (timeEndIndex < 1) {
					fatalError('corrupt session manifest'); // ==0 is negated from occcuring bc the predicate "... == 'T')"
					return null;
				}
				timeEndIndex += index + 1;
				timerDuration = parseInt(line.slice(timeStartIndex, timeEndIndex));
				index = timeEndIndex;
				
			} else {
				fatalError ('corrupt session manifest (timer): ' + line);
				return null;
			}

			// STRICTNESS
			if (line[index] == 'S')
				isStrict = true; // Strict
			else if (line[index] == 'L')
				isStrict = false; // Loose
			else {
				fatalError ('corrupt session manifest (strictness)');
				return null;
			}
			++index;

			// EXPRESSION
			expression = line.slice(index);

			return new Condition(timerDuration, isStrict, expression);	
	}

	// Returns an absolute index into a manifest array of the html field of a given Section record 'sectionIdx'
	function gsmi(sectionIdx) {
		return MANIFEST_HEADER_LEN + MANIFEST_HTML_OFF + (sectionIdx * MANIFEST_SECTION_LEN);
	}

	function getManifestFile(url) {
		
		var xhr = new XMLHttpRequest();
		xhr.callback = extractManifestHtmlFilename;
		xhr.ontimeout = function () {
		    fatalError('The request for "' + url + '" timed out.');
		};
		xhr.onload = function() {
		    if (xhr.readyState === 4) {
		        if (xhr.status === 200) {
		            this.callback.apply(xhr);
		        } else {
		            fatalError('Failed to load manifest file on HTTP status (' + xhr.statusText + ')');
		        }
		    }
		};
		xhr.open('GET', url, true);
		xhr.timeout = 2000;
		xhr.send(null);
	}

	// extract and retrieve HTML files referenced in the manifest file
	function extractManifestHtmlFilename() {
		var mfArr = this.responseText.trimRight().split('\n');
		var fileList = new Array();
		for (let i = MANIFEST_HEADER_LEN + MANIFEST_HTML_OFF; i < mfArr.length; i += MANIFEST_SECTION_LEN) { 
			fileList.push(mfArr[i]);
		}
		getManifestHTML(mfArr, fileList, 0);
	}

	// This function is responsible for retrieving the fileListIdx'th filename in the fileList array asynchronously from the server.
	// On success, it overwrites the html field (currently containing the filename just retrieved) of the fileListIdx'th Section record
	// with the html received from the XHR. It then will increment the fileListIdx and then asynchronously call itself before returining.
	// The async function calls will bottom out when the end of the filelist is reached indexed by the fileListIdx and the Session object
	// is then initialized using the, now complete, manifest.
	function getManifestHTML(manifest, fileList, fileListIdx) {
		// check if we have retreived every external HTML and inserted into the manifest.
		// if so, init the Session object with the complete manifest text.
		if (fileListIdx >= fileList.length) {
			if (init(manifest)) {
				console.log('Successfully initialized Session from manifest.');
				// run the first section, the following section(s) are automagically chained together. 
				// An async call is used before a new section is run to  jump out of the stack (letting it die of natural causes) to 
				// prevent an exceptionally long call chain (see function: runSection)
				runSection();
			} else {
				fatalError('Could not init from manifest.');
			}
			return; 
		}

		var xhr = new XMLHttpRequest();
		xhr.callback = getManifestHTML;
		
		xhr.ontimeout = function () {
			fatalError('The request for ' + this.responseURL + ' timed out.');
		};

		xhr.onload = function() {
		    if (xhr.readyState === 4) {
		        if (xhr.status === 200) {
		        	responseText = this.responseText.replace(/\n/g, ' '); // strip out newlines since they delimit fields in the manifest
		        	manifest[gsmi(fileListIdx)] = this.responseText;
		        	var args = [manifest, fileList, fileListIdx + 1];
		            this.callback.apply(xhr, args);
		        } else {
		            fatalError('Failed to load manifest file on HTTP status (' + xhr.statusText + ')');
		        }
		    }
		};
		var url = TEMPLATE_DIR + fileList[fileListIdx];
		xhr.open('GET', url, true);
		xhr.timeout = XHR_TIMEOUT;
		xhr.send(null);
	}

	/* Hardcoded manifest 'file' for testing purposes. Avoids XHR callouts.*/
	function getDefaultManifest() {	
				
		var consentHTML = '<div><!--Placeholder study Consent Form - to avoid consfusion, the consent form used for the approved study is available separately in the project subdirectory "docs" (c) Mike Clark - 2017-->  <style type="text/css">       @page {  }  body {color:black; background-color:white;}       .greenbutton {        margin-left: 5%;      background-color: #2ecc71;      display: inline-block;      width: 35%;      max-width: 130px;      height: 40px;        color: #ffffff;      border: 1px solid transparent;      border-radius: 5px;      text-decoration: none;      cursor: pointer;      font-size: 13px;      font-weight: bold;      text-transform: uppercase;  }    .greenbutton:active {      background-color: #48E68B;  }    .greenbutton:focus { outline:0;}    .redbutton {      margin-right: 5%;      background-color: #e74c3c;      display: inline-block;      width: 35%;      max-width: 130px;      height: 40px;        color: #ffffff;      border: 1px solid transparent;      border-radius: 5px;      text-decoration: none;      cursor: pointer;      font-size: 13px;      font-weight: bold;      text-transform: uppercase;  }    .redbutton:active {      background-color: #FF6656;  }    .redbutton:focus { outline:0;}    .P13 { font-size:12pt; text-align:left ! important; font-family:Times New Roman; writing-mode:lr-tb; margin-top:0cm; margin-bottom:0.423cm; }     .P26 { font-size:11pt; font-style:italic; text-align:left ! important; font-family:Arial; writing-mode:lr-tb; }  </style>    <div>      <p>               <b>This is where you would place a consent form for the study.<br />          It would contain information such as:</b>          <ul>              <li>Name of Researcher, Faculty, Department, Telephone &amp; Email</li>              <li>Sponsor (e.g. NSERC)</li>              <li>Purpose of the Study</li>              <li>What Will I Be Asked To Do?</li>              <li>What Type of Personal Information Will Be Collected?</li>              <li>Are there Risks or Benefits if I Participate?</li>              <li>What Happens to the Information I Provide?</li>              <li>Questions/Concerns Contact Information</li>          </ul>      </p>      <p>          <b>Followed by a confirmation checkbox and buttons to proceed/cancel/print:</b>      </p>  </div>    <p class="P13">       <form id="otherDataForm" name="otherDataForm">  <input type="checkbox" id="otherDataValidHidden" name="otherDataValidHidden" value="false" onchange="document.getElementById(\'submitResponseButton\').disabled = !this.checked; this.value = this.checked ? \'true\' : \'false\';" />        <span><span class="T26">By checking this box,<br/>                 1) You understand to your satisfaction the information provided to you about your participation in this research project, and <br/>            2) you agree to participate in the research project.     </span></span>        </form>  </p>      <div class="P13"><br /><br /><center>      <button class="redbutton" onclick="alert(\'If you wish to terminate the session without submitting the anonymized data, close the webpage. THIS IS IRREVERSIBLE\');" id="clearResponseButton">I DO NOT CONSENT</button>      <button class="greenbutton" id="submitResponseButton" onclick="                          if (document.getElementById(\'otherDataValidHidden\').value != \'true\') {                              alert(\'Please click the checkbox above.\');                          }">I DO CONSENT</button>          <br /><br /><button id="printButton" onclick="window.print();">Print</button>  </center></div>       </div>    <script type="text/javascript">       document.getElementById("otherDataValidHidden").checked = false;        </script>     </div>';
		var epilogueHTML = '	<div>			<center>				This concludes the study, thank-you for your participation.			</center>		</div>	';
		var instructionGridHTML = '<div>	<center>			<div>				<div style="width: 300px">					<button style="width: 100%" id="submitResponseButton">Done</button>					<br />					<button id="prev" style="width: 49%; margin: 0; padding: 0; border: 1px solid black;" disabled="true"onclick="(function(evt, that){ 							var fbElem = document.querySelectorAll(\'div#flipbook div.page\');							if (!fbElem || fbElem[0].style.display != \'none\')  								return false;							that.nextElementSibling.disabled = false;							for (var i = 1; i < fbElem.length; i++) {								if (fbElem[i].style.display != \'none\') {									fbElem[i].style.display = \'none\';									fbElem[i - 1].style.display = \'block\';									if (i == 1) 										that.disabled = true;								}							}						})(event, this);">						Prev					</button> 					<button id="next" style="width: 49%; margin: 0; padding: 0; border: 1px solid black;" onclick="(function(evt, that){ 							var fbElem = document.querySelectorAll(\'div#flipbook div.page\');							if (!fbElem || fbElem[fbElem.length - 1].style.display != \'none\')  								return false;							that.previousElementSibling.disabled = false;							for (var i = fbElem.length - 2; i >= 0; i--) {								if (fbElem[i].style.display != \'none\') {									fbElem[i].style.display = \'none\';									fbElem[i + 1].style.display = \'block\';									if (i ==  fbElem.length - 2) 										that.disabled = true;								}							}					})(event, this);">						Next					</button>				</div>					<div style="width:300px;" id="flipbook">					<div class="page" id="page00" style="display: block">																		<p>							This password system uses a challenge grid (top) containing a random ordering of shapes, shape-exterior colours, and shape-interior colours.<br />							<br />							The password is shown at the bottom. It will always be four digits in length. A completely grey shape represents a shape attribute (E.g. square, circle), where a partially coloured star will represent either an exterior, or interior colour attribute (depending on which corresponding part of the star is coloured).							<br />							Your task is to enter the password shown by clicking the elements of the challenge grid that contain the attribute for that password digit.						</p>						<img style="border: 2px white dashed"  src="img/3_0.png" />					</div>						<div class="page" id="page0" style="display: none">												<p>							In this example, the password is {<span style="weight: bold; color: rgb(49,113,165)">blue-interior</span>,<b>down-triangle</b>,<span style="weight: bold; color:rgb(136,70,146)">purple-interior</span>,<span style="weight: bold; color:rgb(77,175,74);">green-exterior</span> }.						</p>						<img style="border: 2px white dashed"  src="img/3_0.png" />					</div>					<div class="page" id="page1" style="display: none">												<p>							You would first select the grid element containing the 							<b>right-triangle</b> with <span style="weight: bold; color: rgb(49,113,165)">blue-interior</span> and <span style="weight: bold; color:rgb(77,175,74);">green-exterior</span> ,<br />							since the first password digit is: <span style="weight: bold; color: rgb(49,113,165)">blue-interior</span>.						</p>						<img style="border: 2px white dashed"  src="img/3_1.png" />					</div>					<div class="page" id="page2" style="display: none">												<p>							Followed by the <b>down-triangle</b> with <span style="weight: bold; color:rgb(136,70,146)">purple-interior</span> and 							<span style="weight: bold; color: rgb(152,78,163);">purple-exterior</span>,<br />							since the second password digit is: <b>down-triangle</b>.						</p>						<img style="border: 2px white dashed"  src="img/3_2.png" />					</div>					<div class="page" id="page3" style="display: none">												<p>							Followed by the <b>down-triangle</b> with <span style="weight: bold; color:rgb(136,70,146)">purple-interior</span> and 							<span style="weight: bold; color: rgb(152,78,163);">purple-exterior</span>,<br />							since the third password digit is: <span style="weight: bold; color:rgb(136,70,146)">purple-interior</span>.						</p>						<img style="border: 2px white dashed"  src="img/3_3.png" />					</div>					<div class="page" id="page4" style="display: none">						<p>							Followed by the <b>right-triangle</b> with <span style="weight: bold; color: rgb(49,113,165)">blue-interior</span> and <span style="weight: bold; color:rgb(77,175,74);">green-exterior</span> ,<br />							since the fourth password digit is: <span style="weight: bold; color:rgb(77,175,74);">green-exterior</span>.							<br />							When you are ready to submit the password, click the <span style="color:green; weight:bold;">SUBMIT</span> button.						</p>						<img style="border: 2px white dashed"  src="img/3_4y.png" />					</div>						<div class="page" id="page5" style="display: none">						<p>							If you enter the correct password,							<font color="green">Correct</font> will be displayed							for 0.5 seconds, after which a new challenge and password will then be presented.						</p>						<img style="border: 2px white dashed"  src="img/3_4ye.png" />					</div>					<div class="page" id="page6" style="display: none">						<p>							Otherwise, <font color="red">Incorrect</font> will be displayed							for 0.5 seconds. The challenge and password will remain the same.						</p>						<img style="border: 2px white dashed"  src="img/3_4ne.png" />					</div>					<div class="page" id="page7" style="display: none">						<p>							If you exceed the password length limit of 4, a message will be displayed for 0.5 seconds.<br />							If you make a mistake, you can clear your response by clicking the <span style="color:red; weight:bold;">CLEAR</span> button.						</p>						<img style="border: 2px white dashed"  src="img/3_4le.png" />					</div>					<div class="page" id="page8" style="display: none">						<p>							This concludes the instructions. Please click <b>DONE</b> to continue.						</p>					</div>				</div>			</div>			</center>	</div>';
		var instructionNumericRandomHTML = '	<center>			<div>				<div style="width: 420px">					<button style="width: 100%" id="submitResponseButton">Done</button>					<br />					<button id="prev" style="width: 49%; margin: 0; padding: 0; border: 1px solid black;" disabled="true"onclick="(function(evt, that){ 							var fbElem = document.querySelectorAll(\'div#flipbook div.page\');							if (!fbElem || fbElem[0].style.display != \'none\')  								return false;							that.nextElementSibling.disabled = false;							for (var i = 1; i < fbElem.length; i++) {								if (fbElem[i].style.display != \'none\') {									fbElem[i].style.display = \'none\';									fbElem[i - 1].style.display = \'block\';									if (i == 1) 										that.disabled = true;								}							}						})(event, this);">						Prev					</button> 					<button id="next" style="width: 49%; margin: 0; padding: 0; border: 1px solid black;" onclick="(function(evt, that){ 							var fbElem = document.querySelectorAll(\'div#flipbook div.page\');							if (!fbElem || fbElem[fbElem.length - 1].style.display != \'none\')  								return false;							that.previousElementSibling.disabled = false;							for (var i = fbElem.length - 2; i >= 0; i--) {								if (fbElem[i].style.display != \'none\') {									fbElem[i].style.display = \'none\';									fbElem[i + 1].style.display = \'block\';									if (i ==  fbElem.length - 2) 										that.disabled = true;								}							}					})(event, this);">						Next					</button>				</div>				<div style="width:420px;" id="flipbook">					<div class="page" id="page00" style="display: block">													<p>								This password system uses a numeric challenge grid (top) containing the numerals <b>1</b> through <b>9</b>, however, for each challenge, the numerals will be randomly ordered.								<br />								The password is shown at the bottom and it will always be four digits in length, composed of numerals present in the challenge.								<br />								Your task is to enter the password shown by clicking the elements of the challenge grid.							</p>							<img style="border: 2px white dashed"  src="img/2_0.png" />					</div>						<div class="page" id="page0" style="display: none">												<p>							The password in this example is {<b>4</b>,<b>7</b>,<b>3</b>,<b>9</b>}.						</p>						<img style="border: 2px white dashed"  src="img/2_0.png" />					</div>					<div class="page" id="page1" style="display: none">												<p>							You would first select the <b>4</b> by clicking the square containing that numeral,<br />							since <b>4</b> is the first digit of the password.						</p>						<img style="border: 2px white dashed"  src="img/2_1.png" />					</div>					<div class="page" id="page2" style="display: none">												<p>							Followed by the <b>7</b>, <b>3</b>, and <b>9</b>.<br />							When you are ready to submit the password, click the <span style="color:green; weight:bold;">SUBMIT</span> button.						</p>						<img style="border: 2px white dashed"  src="img/2_4y.png" />					</div>					<div class="page" id="page3" style="display: none">												<p>							If you enter the correct password,							<font color="green">Correct</font> will be displayed							for 0.5 seconds, after which a new challenge and password will then be presented.						</p>						<img style="border: 2px white dashed"  src="img/2_4ye.png" />					</div>					<div class="page" id="page4" style="display: none">												<p>							Otherwise, <font color="red">Incorrect</font> will be displayed							for 0.5 seconds. The challenge and password will remain the same.						</p>						<img style="border: 2px white dashed"  src="img/2_4ne.png" />					</div>										<div class="page" id="page5" style="display: none">												<p>							If you exceed the password length limit of 4, a message will be displayed for 0.5 seconds.<br />							If you make a mistake, you can clear your response by clicking the <span style="color:red; weight:bold;">CLEAR</span> button.						</p>						<img style="border: 2px white dashed"  src="img/2_4le.png" />					</div>						<div class="page" id="page6" style="display: none">						<p>							This concludes the instructions. Please click <b>DONE</b> to continue.						</p>					</div>				</div>			</div>			</center>	';
		var instructionNumericStaticHTML = '		<center>			<div>				<div style="width: 300px">					<button style="width: 100%" id="submitResponseButton">Done</button>					<br />					<button id="prev" style="width: 49%; margin: 0; padding: 0; border: 1px solid black;" disabled="true"onclick="(function(evt, that){ 							var fbElem = document.querySelectorAll(\'div#flipbook div.page\');							if (!fbElem || fbElem[0].style.display != \'none\')  								return false;							that.nextElementSibling.disabled = false;							for (var i = 1; i < fbElem.length; i++) {								if (fbElem[i].style.display != \'none\') {									fbElem[i].style.display = \'none\';									fbElem[i - 1].style.display = \'block\';									if (i == 1) 										that.disabled = true;								}							}						})(event, this);">						Prev					</button> 					<button id="next" style="width: 49%; margin: 0; padding: 0; border: 1px solid black;" onclick="(function(evt, that){ 							var fbElem = document.querySelectorAll(\'div#flipbook div.page\');							if (!fbElem || fbElem[fbElem.length - 1].style.display != \'none\')  								return false;							that.previousElementSibling.disabled = false;							for (var i = fbElem.length - 2; i >= 0; i--) {								if (fbElem[i].style.display != \'none\') {									fbElem[i].style.display = \'none\';									fbElem[i + 1].style.display = \'block\';									if (i ==  fbElem.length - 2) 										that.disabled = true;								}							}					})(event, this);">						Next					</button>				</div>					<div style="width:300px;" id="flipbook">					<div class="page" id="page00" style="display: block">													<p>								This password system uses a numeric challenge grid (top) containing the numerals <b>1</b> through <b>9</b>.								<br />								The password is shown at the bottom and it will always be four digits in length, composed of numerals present in the challenge.								<br />								Your task is to enter the password shown by clicking the elements of the challenge grid.							</p>							<img style="border: 2px white dashed"  src="img/1_0.png" />					</div>						<div class="page" id="page0" style="display: none">												<p>							For example, the password is {<b>9</b>,<b>2</b>,<b>5</b>,<b>7</b>}.						</p>						<img style="border: 2px white dashed"  src="img/1_0.png" />					</div>						<div class="page" id="page1" style="display: none">												<p>							You would first select the <b>9</b> by clicking the square containing that numeral,<br />							since <b>9</b> is the first digit of the password.						</p>						<img style="border: 2px white dashed"  src="img/1_1.png" />					</div>					<div class="page" id="page2" style="display: none">												<p>							Followed by the <b>2</b>, <b>5</b>, and <b>7</b>.<br />							When you are ready to submit the password, click the <span style="color:green; weight:bold;">SUBMIT</span> button.						</p>						<img style="border: 2px white dashed"  src="img/1_4y.png" />					</div>					<div class="page" id="page3" style="display: none">												<p>							If you enter the correct password,							<font color="green">Correct</font> will be displayed							for 0.5 seconds, after which a new challenge and password will then be presented.						</p>						<img style="border: 2px white dashed"  src="img/1_4ye.png" />					</div>					<div class="page" id="page4" style="display: none">												<p>							Otherwise, <font color="red">Incorrect</font> will be displayed							for 0.5 seconds. The challenge and password will remain the same.						</p>						<img style="border: 2px white dashed"  src="img/1_4ne.png" />					</div>					<div class="page" id="page5" style="display: none">												<p>							If you exceed the password length limit of 4, a message will be displayed for 0.5 seconds.<br />							If you make a mistake, you can clear your response by clicking the <span style="color:red; weight:bold;">CLEAR</span> button.						</p>						<img style="border: 2px white dashed"  src="img/1_4le.png" />					</div>						<div class="page" id="page6" style="display: none">						<p>							This concludes the instructions. Please click <b>DONE</b> to continue.						</p>					</div>				</div>				</div>				</center>	';
		var prologueHTML = '	<div>			<center>				<div style="margin-top:100px;">Welcome to a web-based graphical password usability study!</div>				<img onerror="document.getElementById(\'msgElement\').innerHTML = \'<button id=submitResponseButton >Continue</button>\'" src="" />				<br />				<div id=\'msgElement\'>					<noscript> <font style="color: red; weight: 900;">You must enable Javascript for the study website to operate correctly.</font></noscript>				</div>			</center>		</div>	'
		var sectionHTML = '		<div>			<center>				<!--				<h1>				ATTRIBFUSCATOR				</h1>				-->				<div id="challenge-master-pane">					<div id="challenge-pane">						<!--<hr />						<h3>							Challenge						</h3>-->						<!-- JS logic will insert challenge SVG element here -->					</div>					<div id="challenge-control">						<hr />						<button id="clearResponseButton"  class="redbutton">							CLEAR						</button>						<button id="submitResponseButton"  class="greenbutton">							SUBMIT						</button>					</div>					<div id="challengeResponse-pane">						<hr />						<!--<h3>							Response						</h3>-->						<!-- JS logic will insert response SVG element here -->					</div>					<div id="secretCopy-pane">						<hr />						<!--<h3>							Secret						</h3>-->						<!-- JS logic will insert secret response-copy SVG element here -->					</div>					<div id="challengeResponseCopy-pane" class="no-visible">						<!-- JS logic will insert response-copy SVG element here -->					</div>				</div>				<div id="secret-master-pane" >					<div id="secretSpace-pane">						<hr />						<h3>							Secret-space						</h3>						<!-- JS logic will insert secret challenge (I.e. secret-space) SVG element here -->					</div>q					<div id="secret-control">						<hr />						<h3>							Secret Controls						</h3>						<button id="setRandomSecretButton">							Randomize						</button>						<button id="clearSecretButton">							Clear						</button>						<button id="saveSecretButton">							Save						</button>					</div>					<div id="secret-pane">						<hr />						<h3>							Secret						</h3>						<!-- JS logic will insert secret response SVG element here -->					</div>				</div>				<div id="status-master-pane">					<hr />					<h3>						Status					</h3>					<textarea class="status-text"  id="statusTextArea">					</textarea>				</div>				<div id="control-master-pane">					<hr />					<h3>						Mode					</h3>					<input type="radio" name="modeRadioGroup" id="modeChallengeRadio" value="modeChallenge">					<label for="modeChallengeRadio">						Challenge-Response					</label>					<input type="radio" name="modeRadioGroup" id="modeSecretRadio" value="modeSecret" >					<label for="modeSecretRadio">						Secret Setup					</label>					<br />					<label for="modeKeyNumber">						Key Size					</label>					<input type="number" name="modeKeyNumber" id="modeKeyNumber">					<br />					<label for="modeValNumber">						Value Size					</label>					<input type="number" name="modeValNumber" id="modeValNumber">					<br />					<label for="challengeModeRadioGroup">						Challenge Mode					</label>					<input type="radio" name="challengeModeRadioGroup" id="challengeModeIdentityRadio" value="challengeModeIdentity" >					<label for="challengeModeIdentityRadio">						Static					</label>					<input type="radio" name="challengeModeRadioGroup" id="challengeModeRandomRadio" value="challengeModeRandom">					<label for="challengeModeRandomRadio">						Random					</label>					<br />					<button name="modeResetButton" id="modeResetButton">						Reset					</button>					<hr />					<h3>						Telemetry					</h3>					<input type="checkbox" name="enableTelemetryCheckbox" id="enableTelemetryCheckbox" value="telemetrySet" checked="false"/>					<label for="telemetryCheckbox">						Enable Telemetry					</label>					<br />					<input type="text" name="uidTextInput" id="uidTextInput" />					<label for="uidTextInput">						User ID					</label>					<br />					<input type="text" name="sidTextInput" id="sidTextInput" />					<label for="sidTextInput">						Session ID					</label>					<br />					<button name="saveAsTelemetryButton" id="saveAsTelemetryButton">						Save As					</button>					<button name="clearTelemetryButton" id="clearTelemetryButton">						Clear Data Buffers					</button>				</div>			</center>			</div>	';
		var surveyHTML = '		<div>				<style type="text/css">					body {background-color: #eeeeee; color: #010101;}				</style>				<h1>					Study Survey				</h1>				We need to collect demographic information to help us understand the data we gathered. We also ask about your experience and solicit comment.				<form id="otherDataForm" name="otherDataForm">					<hr />					<h3>						Age					</h3>					<input required type="number" name="otherDataAgeNumber" id="otherDataAgeNumber" min="18"  value="" />										<h3>						Sex					</h3>					<input required name="otherDataSexRadioGroup" id="otherDataSexRadioFemale" type="radio" value="F" />					Female					<br />					<input required name="otherDataSexRadioGroup" id="otherDataSexRadioMale" type="radio" value="M" />					Male					<br />						<h3>						What is your profession, or field of study if you are a student?					</h3>					<input required id="otherDataProfessionText" name="otherDataProfessionText" type="text" maxlength="256" />					<br />						<h3>						Country of Residence					</h3>					<input required id="otherDataCountryText" name="otherDataCountryText" type="text" maxlength="256" />					<br />										<h3>						Prior to this session, how many times have you completed this study?					</h3>					<input required name="otherDataFamiliaritySelectRadioGroup" id="otherDataFamiliaritySelectRadioNumber" type="radio" value="number" />					Exactly  								<input type="number" name="otherDataFamiliarityNumber" id="otherDataFamiliarityNumber" value="0" width="2" />					times. 								<br />					<br />					<b>Or, if you cannot remember exactly how many times, approximate:</b>					<br />					<input name="otherDataFamiliaritySelectRadioGroup" id="otherDataFamiliarityRadio1" type="radio" value="1,5" />					1 to 5					<br />					<input name="otherDataFamiliaritySelectRadioGroup" id="otherDataFamiliarityRadio2" type="radio" value="6,10" />					6 to 10					<br />					<input name="otherDataFamiliaritySelectRadioGroup" id="otherDataFamiliarityRadio3" type="radio" value="11,15" />					11 to 15					<br />					<input name="otherDataFamiliaritySelectRadioGroup" id="otherDataFamiliarityRadio4" type="radio" value="16,20" />					16 to 20					<br />					<input name="otherDataFamiliaritySelectRadioGroup" id="otherDataFamiliarityRadio5" type="radio" value="20,INF" />					20+ 			times.					<br />					<h3>						Before this study, how often have you used a 1-9 numeric password system?					</h3>					<input required name="otherDataFamiliarityPastNumericRadioGroup" id="otherDataFamiliarityPastNumericRadio1" type="radio" value="Never" />Never<br />					<input name="otherDataFamiliarityPastNumericRadioGroup" id="otherDataFamiliarityPastNumericRadio2" type="radio" value="A few times a year or sporadically" />A few times a year or sporadically<br />					<input name="otherDataFamiliarityPastNumericRadioGroup" id="otherDataFamiliarityPastNumericRadio3" type="radio" value="A few times a month" />A few times a month<br />					<input name="otherDataFamiliarityPastNumericRadioGroup" id="otherDataFamiliarityPastNumericRadio4" type="radio" value="A few times a week" />A few times a week<br />					<input name="otherDataFamiliarityPastNumericRadioGroup" id="otherDataFamiliarityPastNumericRadio5" type="radio" value="Almost every day or more" />Almost every day or more<br />					<br />					<h3>						Before this study, how often have you used a randomized, 1-9 numeric password system?					</h3>					<input required  name="otherDataFamiliarityPastRndNumericRadioGroup" id="otherDataFamiliarityPastRndNumericRadio1" type="radio" value="Never" />Never<br />					<input name="otherDataFamiliarityPastRndNumericRadioGroup" id="otherDataFamiliarityPastRndNumericRadio2" type="radio" value="A few times a year or sporadically" />A few times a year or sporadically<br />					<input name="otherDataFamiliarityPastRndNumericRadioGroup" id="otherDataFamiliarityPastRndNumericRadio3" type="radio" value="A few times a month" />A few times a month<br />					<input name="otherDataFamiliarityPastRndNumericRadioGroup" id="otherDataFamiliarityPastRndNumericRadio4" type="radio" value="A few times a week" />A few times a week<br />					<input name="otherDataFamiliarityPastRndNumericRadioGroup" id="otherDataFamiliarityPastRndNumericRadio5" type="radio" value="Almost every day or more" />Almost every day or more<br />					<br />					<h3>						Before this study, how often have you used an alternative password system (e.g. pattern unlock, image association)?					</h3>					<input required name="otherDataFamiliarityPastAlternativeRadioGroup" id="otherDataFamiliarityPastAlternativeRadio1" type="radio" value="Never" />Never<br />					<input name="otherDataFamiliarityPastAlternativeRadioGroup" id="otherDataFamiliarityPastAlternativeRadio2" type="radio" value="A few times a year or sporadically" />A few times a year or sporadically<br />					<input name="otherDataFamiliarityPastAlternativeRadioGroup" id="otherDataFamiliarityPastAlternativeRadio3" type="radio" value="A few times a month" />A few times a month<br />					<input name="otherDataFamiliarityPastAlternativeRadioGroup" id="otherDataFamiliarityPastAlternativeRadio4" type="radio" value="A few times a week" />A few times a week<br />					<input name="otherDataFamiliarityPastAlternativeRadioGroup" id="otherDataFamiliarityPastAlternativeRadio5" type="radio" value="Almost every day or more" />Almost every day or more<br />					<br />					<h3>During this study session were you using touch or a mouse?</h3>					<input required name="otherDataInputTypeRadioGroup" id="otherDataInputTypeRadio1" type="radio" value="Touch" />Touch<br />					<input name="otherDataInputTypeRadioGroup" id="otherDataInputTypeRadio2" type="radio" value="Mouse" />Mouse<br />					<h3>					Which best describes the device you accessed this study from:					</h3>					<input required name="otherDataDeviceTypeRadioGroup" id="otherDataDeviceTypeRadio1" type="radio" value="Desktop" />Desktop<br />					<input name="otherDataDeviceTypeRadioGroup" id="otherDataDeviceTypeRadio1" type="radio" value="Laptop" />Laptop<br />					<input name="otherDataDeviceTypeRadioGroup" id="otherDataDeviceTypeRadio1" type="radio" value="Tablet" />Tablet<br />					<input name="otherDataDeviceTypeRadioGroup" id="otherDataDeviceTypeRadio1" type="radio" value="Phone" />Phone<br />					<br />					<h3>						Please describe what helped or hindered the ability to use the new password system					</h3>					<textarea name="otherDataHelpHinderTextarea" cols="40" rows="5" maxlength="4096"></textarea><br />					<br />					<h3>						Do you have any additional comments, suggestions, or improvements?					</h3>					<textarea name="otherDataCommentTextarea" cols="40" rows="5" maxlength="4096"></textarea><br />					<br />					<input name="otherDataValidHidden" id="otherDataValidHidden" type="hidden" value="false">				</form>				<div>					<center>												<br />						<button id="clearResponseButton" class="redbutton" onclick="alert(\'If you wish to terminate the session without submitting the anonymized data, close the webpage. THIS IS IRREVERSIBLE\'); document.getElementById(\'otherDataValidHidden\').value = \'false\';">							CANCEL						</button>						<button id="submitResponseButton" class="greenbutton" onclick="							var isValid = document.getElementById(\'otherDataForm\').querySelectorAll(\':invalid\').length == 0;						  	if (isValid) {						  		isValid = confirm(\'Are you sure you wish to submit your anonymized data to the researchers? THIS IS IRREVERSIBLE\');						  	} else { 						  		alert(\'There are missing responses in the survey!\');						  	}						  	document.getElementById(\'otherDataValidHidden\').value = (isValid ? \'true\': \'false\');">							SUBMIT						</button>					</center>				</div>			</div>	';

		var manifest = ['1', '1', 'remote'];
/*
		manifest = manifest.concat(['11','other', 'off', 'static', 'Prologue', prologueHTML,
			'T0S0',
			'T0S0',
			'T0S_' + REG_TY_ACK_RUN + ',0,>']);
*/
		manifest = manifest.concat(['1','other', 'off', 'static', 'Before we begin, you must complete this consent form.', consentHTML,
			'T0S0',
			'T0S0',
			'T0S_' + REG_TY_ACK_RUN + ',0,>']);

		//NUMERIC
		// instruction
		manifest = manifest.concat(['2','other', 'off', 'static', 'You will now be given instruction on the first password system. Use the "Next" and "Prev" buttons to navigate the instructions and click "Done" when you are finished.', instructionNumericStaticHTML,
			'T0S0',
			'T0S0',
			'T0S_' + REG_TY_ACK_RUN + ',0,>']);

		// training
		manifest = manifest.concat(['3','grid-numeric', 'on', 'static', 'You will now be given training on the first password system. The training will finish when you submit the correct password three times.', sectionHTML, 
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T0S_' + REG_TY_ACK + ',2,>']); 



		// evaluation
		manifest = manifest.concat(['4','grid-numeric', 'on', 'static', 'You will now enter an evaluation phase. This is identical to the training phase, except it will last 1 minute.', sectionHTML,
			'T0S1',
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T60S1']);

		// SCRAMBLED NUMERIC
		// instruction
		manifest = manifest.concat(['5','other', 'off', 'static', 'You will now be given instruction on the second password system. Use the "Next" and "Prev" buttons to navigate the instructions and click "Done" when you are finished.', instructionNumericRandomHTML,
			'T0S0',
			'T0S0',
			'T0S_' + REG_TY_ACK_RUN + ',0,>']);

		// training
		manifest = manifest.concat(['6','grid-numeric', 'on', 'random', 'You will now be given training on the second password system. The training will finish when you submit the correct password three times.', sectionHTML, 
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T0S_' + REG_TY_ACK + ',2,>']); 
		
		// evaluation
		manifest = manifest.concat(['7','grid-numeric', 'on', 'random', 'You will now enter an evaluation phase. This is identical to the training phase, except it will last 1 minute.', sectionHTML,
			'T0S1',
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T60S1']);


		// SCRAMBLED SHAPE-COLOUR-COLOUR
		// instruction
		manifest = manifest.concat(['8','other', 'off', 'static', 'You will now be given instruction on the final password system. Use the "Next" and "Prev" buttons to navigate the instructions and click "Done" when you are finished.', instructionGridHTML,
			'T0S0',
			'T0S0',
			'T0S_' + REG_TY_ACK_RUN + ',0,>']);

		// training
		manifest = manifest.concat(['9','grid', 'on', 'random', 'You will now be given training on the final password system. The training will finish when you submit the correct password three times.', sectionHTML, 
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T0S_' + REG_TY_ACK + ',2,>']); 

		// evaluation
		manifest = manifest.concat(['10','grid', 'on', 'random', 'You will now enter an evaluation phase. This is identical to the training phase, except it will last 1 minute.', sectionHTML,
			'T0S1',
			'T0S_' + REG_TY_ACK_RUN + ',0,>',
			'T60S1']);

		// survey

		manifest = manifest.concat(['11','other', 'on', 'static', 'You will now be asked to complete a short survey. This will help us understand our data better.', surveyHTML,  'T0S0','T0S0','T0S_' + REG_TY_TOT + ',0,>']);

		/*
		manifest = manifest.concat(['12', 'other', 'off', 'static', 'Epilogue', epilogueHTML,
			'T0S0',
			'T0S0',
			'T0S0']);
*/
		// The data will automatically upload when all the sections complete.

		return manifest;
	}

	function init(manifest) {

		// FUTURE: create function for bounds checking arbitrary target and bound
  		if (register.length < 0 || register.length > 4294967296) { 
  			fatalError('register length exceeds 4byte width.');
  			registerLength = 0; //set to a (hopefully) easy to distinguish value
  		}
		return parseManifest(manifest);
	}
	/*******************************************************************************
	 CONSTRUCTOR / PRIVATE MEMEBERS
	*******************************************************************************/

	window.addEventListener('beforeunload', function (e) {
		var confirmationMessage = 'Are you sure you want to exit. Any data generated will be lost.';
		e.returnValue = confirmationMessage;     // Gecko, Trident, Chrome 34+
		return confirmationMessage;              // Gecko, WebKit, Chrome <34
	});

    // run the first section, the following section(s) are automagically chained together. An async call is used before a new section is run to  jump out of the stack (letting it die of natural causes) to prevent an exceptionally long call chain (see function: runSection)
	//if (init(getDefaultManifest()))
	//	runSection();
	

	var hereandnow = window.location.href;
	hereandnow = hereandnow.substr(0, hereandnow.lastIndexOf("/") + 1) + MANIFEST_FILEPATH
	getManifestFile(hereandnow);

}
