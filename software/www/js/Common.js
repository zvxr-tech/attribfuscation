/*******************************************************************************
USER-DEFINED VARIABLES
*******************************************************************************/
var XHR_TIMEOUT =5000; //ms 
var OVERLAY_TIMEOUT = 500; //ms

var EMAIL_SYSADMIN = 'zvxr-tech@users.noreply.github.com';
var TEMPLATE_DIR = 'template/';

//Manifest filename
var MANIFEST_FILENAME = 'study.manifest';
var MANIFEST_FILEPATH = TEMPLATE_DIR + MANIFEST_FILENAME;

//Manifest file layout info used by Session class
// length of the header, this is also the offset of the first Section record, if one exists
var MANIFEST_HEADER_LEN = 3;
// length of a Section record
var MANIFEST_SECTION_LEN = 9;
// field offset of html relative to the start of a Section record
var MANIFEST_HTML_OFF = 5;

/*******************************************************************************
General helper routines
*******************************************************************************/
function fatalError(message) {
	console.error('ERROR: ' +  message);			
	alert('An error has occurred and the study cannot continue.\nPlease contact ' + EMAIL_SYSADMIN + ' with the following information:\n"' + message + '"');
	window.location.reload();
}

function sleep(ms) {
    var tm0 = Date.now();
    while (Date.now() - tm0 < ms) { ;}
}

// Flatten an array
Array.prototype.flatten = function() {
    var ret = [];
    for(var i = 0; i < this.length; i++) {
        if(Array.isArray(this[i])) {
            ret = ret.concat(this[i].flatten());
        } else {
            ret.push(this[i]);
        }
    }
    return ret;
}

// concatenate two Uint16 Typed Arrays
Uint16Array.prototype.concat =function(suffix) {

	var len1 = this.length;
	var len2 = suffix.length;
	var buffer = new Uint16Array(len1 + len2);
	var i = 0;
	for (var j = 0; j < len1; j++, i++) {
		buffer[i] = this[j];
	}
	for (var j = 0; j < len2; j++, i++) {
		buffer[i] = suffix[j];
	}
	return buffer;
}

/*******************************************************************************
Interrupt numbers used to communicate with the Session class.
(Also used by Controller to pass back submit/cancel requests in uiMode='other'.)
*******************************************************************************/
var INO_TIMER = 1;
var INO_SUBMIT_ACK = 2;
var INO_SUBMIT_NAK = 3;
var INO_EXIT = 4;
