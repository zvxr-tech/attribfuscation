/*
Attribfuscator - Controller (shape-colour-colour implementation)
Mike Clark - 2017

Controller for a system that allows for the user to setup a password and attempt to enter the correct response to challenges generated over that password.

The controller is responsible for instantiating a BlackBox to handle the back-end, as well as UserInterfaces to handle the challenge-response pane, as well
as the secret setup pane.

It also handles the user input by way of event handlers on buttons that will then carry out what has been tasked (high-level) by coordinating the invokation and
information sharing between the BlackBox and UI's public interfaces.

Only one instance of the controller should ever exist -- destroying and instantiating another Controller will have undefined results (DOM duplication/incoherence, most likely).
A simple way to accomplish this is by having an anonymous function waiting on the 'onload' event of the document, which then instantiates a single Controller instance before returning control.
Ex.
	<script>
		window.onload = function() { var controller = new Controller(document); };
	</script>


Paramaters:
	docRoot - the DOM root node for the user interface. (usually just document.)

	challengeChallenge* - applies to the challenge in challenge-response mode
	challengeResponse* - applies to the response in challenge-response mode

	secretChallenge* - applies to the challenge in secret-setup mode
	secretResponse* - applies to the response in secret-setup mode

	*Dim* - dimensions of grid.
	*Res* - resolutions of each challenge grid element (px).
	secretSizeMax - artificial maximum response size for UI.

Ex.
	challengeResponseResX = "the resolution in the along X of the challenge-response resonse grid elements (px)"


A data control class (Telemeter) is also used. Optionally, a sessionInterupt function can be passed as a constructor parameter, 
which is a callback made when a response is submitted and an answer obtained as to the response's validity.

The details of the data structures it uses are in the data formats readme.
*/


function Controller(docRoot,
					keySize = 3,
					valSize = 9,
					uiType = 'grid',
					challengeMode = 'challengeModeRandom',
					challengeChallengeDimX = 3, challengeChallengeDimY = 3,
					challengeChallengeResX = 100, challengeChallengeResY = 100,
					challengeResponseDimX = 9,  challengeResponseDimY = 1,
					challengeResponseResX = 100,  challengeResponseResY = 100,
					secretChallengeDimX = 9, secretChallengeDimY = 3,
					secretChallengeResX = 100, secretChallengeResY = 100,
					secretResponseDimX = 9, secretResponseDimY = 1,
					secretResponseResX = 100, secretResponseResY = 100,
					secretSizeMin = 1, secretSizeMax = 9,
					sessionInterrupt, telemetryRunFlag = false) {
	var that = this;
	
	
	var challengeModeEnum = {'random':0, 'static':1}; // FUTURE: replace values/strings with enumerations
	var uiTypeEnum = {'grid':0, 'grid-numeric':1, 'dial':2};
	

	/*******************************************************************************
	 PRIVILEGED
	*******************************************************************************/
	/*
	The return values of the event handlers return false,
	so that the browser does not act on them after we are done
	our logic
	
	New Challenge
		- Generate a new challenge from the Blackbox and display in the challengeUI.
	
	Clear Response
		- Clear a response to a challenge in the challengeUI.

	Submit Response
		- Submit a response to a challenge in the challengeUI.

	Random Secret
		- select a random password of a random length (at, or less than, a fixed  maximum length)
			from the secret-space and commit it to the BlackBox.

	Clear Secret
		- clear the secret selection response  in the secretUI.

	Save Secret
		- save and commit the current response (I.e. secret) selected in the secretUI to the BlackBox.

	Toggle Mode
		- toggle between password setup mode, and challenge-response mode.

	Reset
		- You can create a new system with different parameters (attribute key and value size).
			The Controller will not be destroyed, but all of it's subjugates will be.
			
			
	Enable Telemetry
		Enable telemetry logging to buffers.
	
	Disable Telemetry
		Disable telemetry logging to buffers.	

	Save Telemetry As
		Save telemetry buffers to local file.
	
	Clear Telemetry
		Clear the telemetry buffers. (reset index and zero out contents).

	cleanup
		- This will cleanup the  Blackbox, UserInterfaces, and Telemeter.
	*/

	this.cleanup = function () {return cleanup();}

	/* We have a possible race condition with the 'onchange' handler,
	so we cannot accurately determine if the click activated (successfully) or
	deactivated the telemeter. This logs in the same time domain as the mouse movement, clicks, and other
	events, and can be correlated with the corresponding event immediately proceeding this one which uses
	a unix timestamp.
	*/
	

	/* used by Session to manually enable telemetry */
	this.enableTelemetry = function (evt) {
			telemeter.logEvent(evt, telemeter.EVENT_TY_ACTIVATIONCHANGE , []); 
				return telemeter.activate(evt)
	}

	this.enableTelemetryClickHandler = function (evt) {
			telemeter.logEvent(evt, telemeter.EVENT_TY_ACTIVATIONCHANGE , []);
	}

	this.enableTelemetryChangedHandler = function (evt) {
		if (this.checked) {
			// we are turning telemetry ON
			if (telemeter && !telemeter.activate(evt)) 
				this.checked = false;
			
		} else {
			// we are turning telemetry OFF
			telemeter.deactivate(evt);
			console.log('Telemetry disabled');
		}
		return false;
	}
	
	this.clearTelemetryButton = function (evt) {
		if (confirm('Are you sure you would like to clear the telemetry data?'))
			telemeter.cleanup();
		return false;
	}

	this.saveAsTelemetryClickHandler = function (evt) {
		if (telemeter && telemeter.isActive) {
			telemeter.deactivate(evt);
			enableTelemetryCheckbox.checked = false;
		}

		var uid = uidTextInput.value;
		var sid = sidTextInput.value;
		telemeter.saveToFile(uid, sid);
			
		return false;
	}
	
	this.newChallengeClickHandler = function (evt) {
		var challenge = blackBox.nextChallenge();
		challengeUI.newChallengeHandler(challenge);
		statusLog('New challenge generated.', false);
		if (telemeter && telemeter.isActive) {
			flatChallenge = challenge.flatten();
			telemeter.logEvent(evt, telemeter.EVENT_TY_NEWCHALLENGE, flatChallenge);
		}
		return false;
	}


	this.clearResponseClickHandler = function(evt) {
	    challengeUI.clearResponseHandler();
	    
	    if (telemeter && telemeter.isActive) {
	    	telemeter.logEvent(evt, telemeter.EVENT_TY_RESPONSECLEAR, []);
	    }
		statusLog('Response cleared.', false);
	    return false;
	}

	this.submitResponseClickHandler = function (evt) {
		var response = challengeUI.storeResponseHandler(); 
		var answer = blackBox.acceptGeneric(response, 'challenge');
		
		
		if (telemeter && telemeter.isActive) {
			var flatResponse = response.flatten();
			var data = [answer].concat(flatResponse);
			telemeter.logEvent(evt, telemeter.EVENT_TY_SUBMIT, data);
		}

		var statusStr = (answer ? 'Correct' : 'Incorrect');
		if (overlayPane) {

				overlayPane.innerHTML = '<br /><h1  style=" background: black; opacity: 1.0 ;color:' + (answer ? "green" : "red") + ';">' + statusStr + '</h1>';
				overlayPane.style.display = 'block';
				overlayTimer = setTimeout(function () {
					overlayPane.style.display = 'none';
					//that.challengeUI.clearResponseHandler();
					that.clearResponseClickHandler(new Event('click'));
				}, OVERLAY_TIMEOUT);
		} else {
			challengeUI.clearResponseHandler(); //Incorporated into overlay logic
		}

		if (sessionInterrupt) {
			if (answer) {
				sessionInterrupt(INO_SUBMIT_ACK);
			} else {
				sessionInterrupt(INO_SUBMIT_NAK);
			}
		}
		statusLog('Response Submitted: ' + statusStr, false);
		return false;
	}

	this.exportTelemetryData = function () {
		return telemeter.exportData();
	}

	this.exportTelemetryVersion = function () {
		return telemeter.version;	
	}

	this.shutdown = new Promise((resolve, reject) => {
   		destroyHandlers();
  		resolve();
	});

	this.setRandomSecretClickHandler = function () {
		
		var secret = generateRandomSecret();
		secretUI.clearResponseHandler();
		for (let i = 0; i < secret.length; i++) {
			secretUI.challengeDigitSelectHandler({'target': {'id': secret[i]}}); // create an anonymous, phony event object with just the pertinent nfo
		}
		statusLog('Random secret generated.', false)
		return false;
	}

	this.saveSecretClickHandler = function (evt) {
		var response = secretUI.storeResponseHandler(); 
		var validity = blackBox.acceptGeneric(response, 'secret');
		statusLog('Secret saved: ' + (validity ? 'PASS' : 'FAIL'), false);
		if (telemeter && telemeter.isActive) {
			telemeter.logEvent(evt, telemeter.EVENT_TY_NEWSECRET, [(validity?1:0)].concat(response));
		}
		return false;
	}

	this.clearSecretClickHandler = function () {
		secretUI.clearResponseHandler();
		statusLog('Secret cleared.', false)
		return false;
	}

	this.modeRadioClickHandler = function (evt) {
		if (evt.target.value == 'modeChallenge' ) {
			secretUI.loadResponseHandler();
			challengeMasterPane.style.display = 'block';
			secretMasterPane.style.display = 'none';
			statusLog('Challenge-Response mode.', false);
		} else if (evt.target.value == 'modeSecret' ) {
			challengeMasterPane.style.display = 'none';
			secretMasterPane.style.display = 'block';
			statusLog('Secret Setup mode.', false);
		}
		return false;
	}

	this.resetModeClickHandler = function () {
		// scrape the DOM for new key and val sizes
		var keySizeParam = parseInt(modeKeyNumber.value, 10);
		var valSizeParam = parseInt(modeValNumber.value, 10);
		var challengeMode = document.querySelector('input[type="radio"][name="challengeModeRadioGroup"]:checked').value;
		


		var dimY = 0;
		var dimX = 0;

		if ((uiType == 'grid') || (uiType == 'grid-numeric')) {
			// calculate challenge grid closest to square (whole numbers)	
			dimY = Math.floor(Math.sqrt(valSizeParam));
			dimX = Math.ceil(valSizeParam / dimY);
			// calling reset with undefined parameters will result in the private variables they map to having their values being preserved.
			reset(keySizeParam, valSizeParam, uiType, 
				challengeMode, 
				dimX, dimY, undefined, undefined, /*challengeChallenge Dim/Res X/Y)*/
				undefined, 1, undefined, undefined, /*challengeResponse Dim/Res X/Y)*/
				valSizeParam, keySizeParam, undefined, undefined, /*secretChallenge Dim/Res X/Y)*/
				secretSizeMax, 1, undefined, undefined,  /*secretResponse Dim/Res X/Y)*/
				undefined, undefined); /*secretSizeMin, secretSizeMax*/
		} else if (uiType == 'dial') {
			dimY = keySizeParam;
			dimX = valSizeParam;
			// calling reset with undefined parameters will result in the private variables they map to having their values being preserved.
			reset(keySizeParam, valSizeParam, uiType,
				challengeMode, 
				dimX, dimY, undefined, undefined, /*challengeChallenge Dim/Res X/Y)*/
				undefined, keySizeParam, undefined, undefined, /*challengeResponse Dim/Res X/Y)*/
				valSizeParam, keySizeParam, undefined, undefined, /*secretChallenge Dim/Res X/Y)*/ 
				secretSizeMax, keySizeParam, undefined, undefined,  /*secretResponse Dim/Res X/Y)*/
				undefined, undefined); /*secretSizeMin, secretSizeMax*/
		} else {
			fatalError('ASSERT: Invalid uiType "' + uiType + '"' );
			return;
		}

		enableTelemetryCheckbox.checked  = false;

		statusLog('Reset system with keySize=' + keySizeParam + ' and valSize=' + valSizeParam + '.', false);
		return false;
	}
	
	/*******************************************************************************
	 PRIVATE
	*******************************************************************************/

	/* Display a meessage in the statusLog text area.
		If isTransient is set, the message overwrites the pre-existing message(s) and a timer is
		set, after which time the message area is cleared.
		Otherwise, the message is appended onto a new line of the existing message(s).
	*/
	function statusLog(str, isTransient) {
		if (isTransient) {
			clearTimeout(statusTimer);
			statusTextArea.value =  str ;
			statusTimer = setTimeout(function(){ statusTextArea.value = ''; statusTimer = null}, 3000)
		} else {
			statusTextArea.value = statusTextArea.value + '\n' + str ;
			statusTextArea.scrollTop = statusTextArea.scrollHeight;
		}	
	}
	
	/* Select a random (bounded) number of secret digits,
		each  encoded as the linear address into the secret-space 
		Assumes that  secretSize* are whole numbers (I.e. Not 4.7).
	*/
	function generateRandomSecret() {
		var ss = Math.floor(Math.random() * (secretSizeMax + 1 - secretSizeMin) + secretSizeMin);
		
		var sec = new Array(); //secret
		for (let i = 0; i < ss; i++)
			sec.push(Math.floor(Math.random()*keySize*valSize));
		return sec;
	}


	function destroyHandlers() {
		if (enableTelemetryCheckbox)	enableTelemetryCheckbox.removeEventListener('change', that.enableTelemetryChangedHandler);
		if (enableTelemetryCheckbox)	enableTelemetryCheckbox.removeEventListener('click', that.enableTelemetryClickHandler);
		if (saveAsTelemetryButton)	saveAsTelemetryButton.removeEventListener('click', that.saveAsTelemetryClickHandler);
		if (clearTelemetryButton)	clearTelemetryButton.removeEventListener('click', that.clearTelemetryButton);
		
		
		if (clearResponseButton)	clearResponseButton.removeEventListener('click', that.clearResponseClickHandler);
	    if (submitResponseButton)	submitResponseButton.removeEventListener('click', that.submitResponseClickHandler);
	    if (newChallengeButton)	newChallengeButton.removeEventListener('click', that.newChallengeClickHandler);

	    if (modeChallengeRadio)	modeChallengeRadio.removeEventListener('click', that.modeRadioClickHandler);
	    if (modeSecretRadio)	modeSecretRadio.removeEventListener('click', that.modeRadioClickHandler);
		if (modeResetButton)	modeResetButton.removeEventListener('click', that.resetModeClickHandler);

	    if (saveSecretButton)	saveSecretButton.removeEventListener('click', that.saveSecretClickHandler);
	    if (clearSecretButton)	clearSecretButton.removeEventListener('click', that.clearSecretClickHandler);
	    if (setRandomSecretButton)	setRandomSecretButton.removeEventListener('click', that.setRandomSecretClickHandler);
	}

	/* Constructor helper routine: Event Handlers */
	function initHandlers() {
		
		if (enableTelemetryCheckbox)	enableTelemetryCheckbox.addEventListener('change', that.enableTelemetryChangedHandler);
		if (enableTelemetryCheckbox)	enableTelemetryCheckbox.addEventListener('click', that.enableTelemetryClickHandler);
		if (saveAsTelemetryButton)	saveAsTelemetryButton.addEventListener('click', that.saveAsTelemetryClickHandler);
		if (clearTelemetryButton)	clearTelemetryButton.addEventListener('click', that.clearTelemetryButton);
		
		
		if (clearResponseButton)	clearResponseButton.addEventListener('click', that.clearResponseClickHandler);
	    if (submitResponseButton)	submitResponseButton.addEventListener('click', that.submitResponseClickHandler);
	    if (newChallengeButton)	newChallengeButton.addEventListener('click', that.newChallengeClickHandler);

	    if (modeChallengeRadio)	modeChallengeRadio.addEventListener('click', that.modeRadioClickHandler);
	    if (modeSecretRadio)	modeSecretRadio.addEventListener('click', that.modeRadioClickHandler);
		if (modeResetButton)	modeResetButton.addEventListener('click', that.resetModeClickHandler);

	    if (saveSecretButton)	saveSecretButton.addEventListener('click', that.saveSecretClickHandler);
	    if (clearSecretButton)	clearSecretButton.addEventListener('click', that.clearSecretClickHandler);
	    if (setRandomSecretButton)	setRandomSecretButton.addEventListener('click', that.setRandomSecretClickHandler); 
	}



	

	function cleanup() {
		// clear timers
		clearTimeout(overlayTimer);
		overlayTimer = null;
		clearTimeout(statusTimer);
		statusTimer = null;
		
		if (telemeter) {

			if (telemeter.isActive) {
				telemeter.deactivate(new Event('click'));
			}
			telemeter.cleanup();
			telemeter = null;
		}

		if (blackBox) {
			blackBox.cleanup();
	    	blackBox = null;
	    }

	    if (challengeUI) {
	    	challengeUI.cleanup();
		    challengeUI = null;
		}

	    if (secretUI) {
	    	secretUI.cleanup();
	    	secretUI = null;
		}
		
	}



	/* reset will default to the existing values private values. This is useful in the constructor during a parameterized instantiation. */
	function reset(keySizeParam = keySize,
					valSizeParam = valSize,
					uiTypeParam = uiType,
					challengeModeParam = challengeMode,
					challengeChallengeDimXParam = challengeChallengeDimX, challengeChallengeDimYParam = challengeChallengeDimY,
					challengeChallengeResXParam = challengeChallengeResX, challengeChallengeResYParam = challengeChallengeResY,
					challengeResponseDimXParam = challengeResponseDimX,  challengeResponseDimYParam = challengeResponseDimY,
					challengeResponseResXParam = challengeResponseResX,  challengeResponseResYParam = challengeResponseResY,
					secretChallengeDimXParam = secretChallengeDimX, secretChallengeDimYParam = secretChallengeDimY,
					secretChallengeResXParam = secretChallengeResX, secretChallengeResYParam = secretChallengeResY,
					secretResponseDimXParam = secretResponseDimX, secretResponseDimYParam = secretResponseDimY,
					secretResponseResXParam = secretResponseResX, secretResponseResYParam = secretResponseResY,
					secretSizeMinParam = secretSizeMin, secretSizeMaxParam = secretSizeMax,
					telemetryRunFlagParam = telemetryRunFlag) {
		
		
		if (telemeter && telemeter.hasData() && confirm("There is data in the buffers, would you like to save it?")) {
			var uid = uidTextInput.value;
			var sid = sidTextInput.value;
			telemeter.saveToFile(uid, sid);
		}
		cleanup();

		keySize = keySizeParam;
		valSize = valSizeParam;

		challengeChallengeDimX = challengeChallengeDimXParam;
		challengeChallengeDimY = challengeChallengeDimYParam;
		
		challengeChallengeResX = challengeChallengeResXParam;
		challengeChallengeResY = challengeChallengeResYParam;
		
		challengeResponseDimX = challengeResponseDimXParam;
		challengeResponseDimY = challengeResponseDimYParam;

		challengeResponseResX = challengeResponseResXParam;
		challengeResponseResY = challengeResponseResYParam;
	
		secretChallengeDimX = secretChallengeDimXParam;
		secretChallengeDimY = secretChallengeDimYParam;
		
		secretChallengeResX = secretChallengeResXParam;
		secretChallengeResY = secretChallengeResYParam;
		
		secretResponseDimX = secretResponseDimXParam;
		secretResponseDimY = secretResponseDimYParam;

		secretResponseResX = secretResponseResXParam;
		secretResponseResY = secretResponseResYParam;
		
		secretSizeMin = secretSizeMinParam;
		secretSizeMax = secretSizeMaxParam;
		uiType = uiTypeParam;
		challengeMode = challengeModeParam;

		telemetryRunFlag = telemetryRunFlagParam;

		// REINSTANCE
		statusTimer = null;

		telemeter = new Telemeter(docRoot);
		if (telemetryRunFlag) {
			if (!that.enableTelemetry(new Event('click')))
				fatalError('ASSERT: Telemetry could not be enabled!');
		}
		//challengeModeRandomRadio.checked = true;
		if (telemeter && telemeter.isActive)
			telemeter.logEvent(new Event(''), telemeter.EVENT_TY_CTLRESET, serializeControllerParams());
		

		blackBox = new BlackBox(keySize, valSize, challengeMode);
		switch (uiType) {
			case 'grid':
				challengeUI = new UserInterfaceGrid(docRoot,
									challengeChallengeDimX, challengeChallengeDimY,
									challengeChallengeResX, challengeChallengeResY,
									challengeResponseDimX, challengeResponseDimY,
									challengeResponseResX, challengeResponseResY,
									initKeyValShapeColour, keySize,
									valSize, secretSizeMax,
									'challenge-svg', challengePane,
									'challengeResponse-svg', challengeResponsePane,
									'challengeResponseCopy-svg', challengeResponseCopyPane,
									overlayPane); 

				secretUI = new UserInterfaceGrid(docRoot, 
									secretChallengeDimX, secretChallengeDimY,
									secretChallengeResX, secretChallengeResY,
									secretResponseDimX, secretResponseDimY,
									secretResponseResX, secretResponseResY,
									initKeyValShapeColour, keySize,
									valSize, secretSizeMax,
									'secretSpace-svg', secretPane,
									'secret-svg', secretResponsePane,
									'secretCopy-svg', secretResponseCopyPane,
									overlayPane); 
				break
			case 'grid-numeric' :
				// FUTURE: fold this mode into 'grid', since only valKey differs
				challengeUI = new UserInterfaceGrid(docRoot,
									challengeChallengeDimX, challengeChallengeDimY,
									challengeChallengeResX, challengeChallengeResY,
									challengeResponseDimX, challengeResponseDimY,
									challengeResponseResX, challengeResponseResY,
									initKeyValNumericGrid, keySize,
									valSize, secretSizeMax,
									'challenge-svg', challengePane,
									'challengeResponse-svg', challengeResponsePane,
									'challengeResponseCopy-svg', challengeResponseCopyPane,
									overlayPane); 

				secretUI = new UserInterfaceGrid(docRoot, 
									secretChallengeDimX, secretChallengeDimY,
									secretChallengeResX, secretChallengeResY,
									secretResponseDimX, secretResponseDimY,
									secretResponseResX, secretResponseResY,
									initKeyValNumericGrid, keySize,
									valSize, secretSizeMax,
									'secretSpace-svg', secretPane,
									'secret-svg', secretResponsePane,
									'secretCopy-svg', secretResponseCopyPane,
									overlayPane);
				break
			case 'dial':
				challengeUI = new UserInterfaceDialChallenge(docRoot,
									challengeChallengeDimX, challengeChallengeDimY,
									challengeChallengeResX, challengeChallengeResY,
									challengeResponseDimX, challengeResponseDimY,
									challengeResponseResX, challengeResponseResY,
									initKeyValNumericDial, keySize,
									valSize, secretSizeMax,
									'challenge-svg', challengePane,
									'challengeResponse-svg', challengeResponsePane,
									'challengeResponseCopy-svg', challengeResponseCopyPane,
									overlayPane); 

				secretUI = new UserInterfaceDialSecret(docRoot, 
									secretChallengeDimX, secretChallengeDimY,
									secretChallengeResX, secretChallengeResY,
									secretResponseDimX, secretResponseDimY,
									secretResponseResX, secretResponseResY,
									initKeyValNumericGrid, keySize,
									valSize, secretSizeMax,
									'secretSpace-svg', secretPane,
									'secret-svg', secretResponsePane,
									'secretCopy-svg', secretResponseCopyPane,
									overlayPane); 
				break;
				case 'other':
					fatalError('ASSERT: Unsupported UI Mode "' + uiType + '"');
				break;
			default:
				fatalError('ASSERT: Unsupported UI Mode "' + uiType + '"');
				break;
		}


		
		/* On instantiation, use the existing functionality to: 
			get fresh challenge,
			select and submit a random secret, and
			switch to challenge-response mode
		*/
		that.newChallengeClickHandler(new Event('click'));
		
		secretUI.newChallengeHandler(blackBox.getSparseSecretSpace());
		that.setRandomSecretClickHandler();
		that.saveSecretClickHandler(new Event('click'));
		
		
		modeChallengeRadio.checked = true;
		that.modeRadioClickHandler({'target': {'value': 'modeChallenge'}}); // spoof the radiobutton selection event by creating an anonymous, phony event object with just the pertinent nfo


		
		
		
	}


	function serializeControllerParams() {
		var params = [parseInt(keySize),
						parseInt(valSize)];
		//"hello\n".split('').map(function (x) {return x.charCodeAt();})
		params = params.concat(uiType.concat('\n').split('').map(function (x) {return x.charCodeAt();}));
		params = params.concat(challengeMode.concat('\n').split('').map(function (x) {return x.charCodeAt();}));
		

		params = params.concat([parseInt(challengeChallengeDimX),
			parseInt(challengeChallengeDimY),
			parseInt(challengeChallengeResX),
			parseInt(challengeChallengeResY),
			parseInt(challengeResponseDimX),
			parseInt(challengeResponseDimY),
			parseInt(challengeResponseResX),
			parseInt(challengeResponseResY),
			parseInt(secretChallengeDimX),
			parseInt(secretChallengeDimY),
			parseInt(secretChallengeResX),
			parseInt(secretChallengeResY),
			parseInt(secretResponseDimX),
			parseInt(secretResponseDimY),
			parseInt(secretResponseResX),
			parseInt(secretResponseResY),
			parseInt(secretSizeMin),
			parseInt(secretSizeMax)]);

		return params;
	}
	/*******************************************************************************
	 CONSTRUCTOR / PRIVATE MEMEBERS
	*******************************************************************************/

	//Scrape the document root for known element identifiers.	

	var challengeMasterPane = docRoot.getElementById('challenge-master-pane');
    var challengePane = docRoot.getElementById('challenge-pane');
    var challengeResponsePane = docRoot.getElementById('challengeResponse-pane');
    var challengeResponseCopyPane = docRoot.getElementById('challengeResponseCopy-pane');
	var submitResponseButton = docRoot.getElementById('submitResponseButton');
	var newChallengeButton = docRoot.getElementById('newChallengeButton');
	var clearResponseButton = docRoot.getElementById('clearResponseButton');


    var secretMasterPane = docRoot.getElementById('secret-master-pane');
    var secretPane = docRoot.getElementById('secretSpace-pane');
    var secretResponsePane = docRoot.getElementById('secret-pane'); 
    var secretResponseCopyPane = docRoot.getElementById('secretCopy-pane'); 
	var clearSecretButton = docRoot.getElementById('clearSecretButton');
	var setRandomSecretButton = docRoot.getElementById('setRandomSecretButton');

	var modeChallengeRadio = docRoot.getElementById('modeChallengeRadio');
	var challengeModeRandomRadio = docRoot.getElementById('challengeModeRandomRadio');
	var modeKeyNumber = docRoot.getElementById('modeKeyNumber');
	var modeValNumber = docRoot.getElementById('modeValNumber');
    var statusTextArea = docRoot.getElementById('statusTextArea');
	var uidTextInput = docRoot.getElementById('uidTextInput');
	var sidTextInput = docRoot.getElementById('sidTextInput');

	var enableTelemetryCheckbox = docRoot.getElementById('enableTelemetryCheckbox');
	var clearTelemetryButton = docRoot.getElementById('clearTelemetryButton');
	var saveAsTelemetryButton = docRoot.getElementById('saveAsTelemetryButton');

	var saveSecretButton = docRoot.getElementById('saveSecretButton');
	var modeResetButton = docRoot.getElementById('modeResetButton');
	var modeSecretRadio = docRoot.getElementById('modeSecretRadio');

	var otherDataForm = docRoot.getElementById('otherDataForm');
	var overlayPane = docRoot.getElementById('overlay-pane');


	// declare private vars not present in constructor signature
    var blackBox = null;
    var challengeUI = null;
    var secretUI = null;
    var statusTimer = null;
    
   	var overlayTimer;
	var OVERLAY_TIMEOUT = OVERLAY_TIMEOUT	

	var otherData;
	var telemeter;
	

	
	if (uiType == 'other') {    
		// telemeter instantiation and possible running is done in reset() which is not called on uiType 'other'
		// so we do it manually here
		telemeter = new Telemeter(docRoot);
		if (telemetryRunFlag) {
			if (!that.enableTelemetry(new Event('click')))
					fatalError('ASSERT: Telemetry could not be enabled!');			
		}
		 

		if (clearResponseButton)
			clearResponseButton.addEventListener('click', function () {
	    		// send a submit nak to the session manager (if one exists)
	    		if (sessionInterrupt) {
	    			if (otherDataForm) {
						if ((!otherDataForm.otherDataValidHidden) || (otherDataForm.otherDataValidHidden.value == "true")) {
							// do not serialize data
							
						} else { 
							console.error('"other" NAK response rejected because the validity hidden field was not set to "true"'); 
							return null;
						}
	    			}
	    			sessionInterrupt(INO_SUBMIT_NAK)
	    		}
			});
	    if (submitResponseButton)
	    	submitResponseButton.addEventListener('click', function (evt) {
	    		// send a submit ack to the session manager (if one exists)
	    		if (sessionInterrupt) {
	    			if (otherDataForm) {
						if ((!otherDataForm.otherDataValidHidden) || (otherDataForm.otherDataValidHidden.value == "true")) {
							otherData = new FormData(otherDataForm);
	    				  	var strData = "";
	    				  	for(var pair of otherData.entries()) {
	    				  		strData = strData.concat(pair[0], '\n', pair[1], '\n');
							}
							var encData = new TextEncoder("utf-8").encode(strData);
							if (!encData) {
								fatalError("ASSERT: Encoding error for form data.");
								return null;
							}
							//var decData = new TextDecoder("utf-8").decode(encData);
							//console.log("UTF-8 decode:" + decData)
							if (encData.length > 0 && encData.length <= telemeter.MAX_OTHERDATA) {
								telemeter.logEvent(evt, telemeter.EVENT_TY_OTHERDATA, encData);
							}
						} else { 
							console.error('"other" ACK response rejected because the validity hidden field was not set to "true"')
							return null;
						}
	    			}
	    			sessionInterrupt(INO_SUBMIT_ACK)
	    		}
	    	});
	} else {
		// event handler init
		initHandlers(); 

		// set defaults and limits for comboboxes
		if (modeKeyNumber) {
			modeKeyNumber.min = 1;
			modeKeyNumber.max = keySize;
			modeKeyNumber.value = modeKeyNumber.max < 3 ? modeKeyNumber.max : 3;
		}

		if (modeValNumber) {
			modeValNumber.min = 1;
			modeValNumber.max = valSize;
			modeValNumber.value = modeValNumber.max < 9 ? modeValNumber.max : 9;
		}
		
		if (enableTelemetryCheckbox)
			enableTelemetryCheckbox.checked = false;
		if (uidTextInput)
			uidTextInput.value = '';
		if (sidTextInput)
			sidTextInput.value = '';
		if (challengeModeRandomRadio)
			challengeModeRandomRadio.checked = true;	

		reset();
	}
	if (!window.onbeforeunload) {
		window.onbeforeunload = function (e) {
			var confirmationMessage = "Are you sure you want to exit? Any data generated will be lost.";
			e.returnValue = confirmationMessage;     // Gecko, Trident, Chrome 34+
			return confirmationMessage;              // Gecko, WebKit, Chrome <34
		};
	}
}
