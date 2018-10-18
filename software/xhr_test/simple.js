function Session() {
	/******************************************************/
	// Exists in Session.js, but this test does not include that file so we have it copied in here
	var docRoot = document;
	function swapHTML(str) {
		var parser = new DOMParser();
		//parseFromString will automatically append some DOM objects, so we need to navigate back to the root <div> tag of the htm file lodaded
		var src = parser.parseFromString(str, 'text/html').children[0].lastChild.children[0]; 
		var dst = docRoot.body.children[docRoot.body.children.length - 1];
		var replacedNode = docRoot.body.replaceChild(src, dst);
	}
	/******************************************************/

	// Returns an absolute index into a manifest array of the html field of a given Section record 'sectionIdx'
	function gsmi(sectionIdx) {
		return MANIFEST_HEADER_LEN + MANIFEST_HTML_OFF + (sectionIdx * MANIFEST_SECTION_LEN);
	}

	function getManifestFile(url) {
		
		var xhr = new XMLHttpRequest();
		xhr.callback = extractManifestHtmlFilename;
		xhr.ontimeout = function () {
		    fatalError("The request for " + url + " timed out.")
		    //swapHTML(userErrorMsg)
		};
		xhr.onload = function() {
		    if (xhr.readyState === 4) {
		        if (xhr.status === 200) {
		            this.callback.apply(xhr);
		        } else {
		            fatalError('Failed to load manifest file on HTTP status (' + xhr.statusText + ')')
		            //swapHTML(userErrorMsg)
		        }
		    }
		};
		xhr.open("GET", url, true);
		xhr.timeout = XHR_TIMEOUT;
		xhr.send(null);
	}

	// extract and retrieve HTML files referenced in the manifest file
	function extractManifestHtmlFilename() {
		var mfArr = this.responseText.split('\n')
		var fileList = new Array()
		for (let i = MANIFEST_HEADER_LEN + MANIFEST_HTML_OFF; i < mfArr.length; i += MANIFEST_SECTION_LEN) { 
			fileList.push(mfArr[i])
		}
		getManifestHTML(mfArr, fileList, 0)
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
				console.log("Successfully initialized Session from manifest.")
			} else {
				fatalError('Could not init from manifest.')
				//swapHTML(userErrorMsg)
			}
			return 
		}

		var xhr = new XMLHttpRequest();
		xhr.callback = getManifestHTML; 
		
		xhr.ontimeout = function () {
			fatalError("The request for " + this.responseURL + " timed out.")
		    //swapHTML(userErrorMsg)
		};

		xhr.onload = function() {
		    if (xhr.readyState === 4) {
		        if (xhr.status === 200) {
		        	responseText = this.responseText.replace(/\n/g, " ") // strip out newlines since they delimit fields in the manifest

		        	manifest[gsmi(fileListIdx)] = this.responseText  
		        	var args = [manifest, fileList, fileListIdx + 1]
		            this.callback.apply(xhr, args);
		        } else {
		            fatalError("Failed to load manifest file on HTTP status (" + xhr.statusText + ')')
		            //swapHTML(userErrorMsg)
		        }
		    }
		};
		var url = TEMPLATE_DIR + fileList[fileListIdx]
		xhr.open("GET", url, true);
		xhr.timeout = XHR_TIMEOUT;
		xhr.send(null);
	}

	function init(mf) {
		manifest = mf.join('\n');
		swapHTML(mf[gsmi(0)]) // show the first section.
		console.log(manifest)
		return 1
	}

	var hereandnow = window.location.href;
	hereandnow = hereandnow.substr(0, hereandnow.lastIndexOf("/") + 1) + MANIFEST_FILEPATH
	getManifestFile(hereandnow);
}
