/*
Attribfuscator - User Interface Grid (shape-colour-colour implementation)
Mike Clark - 2017

UserInterface is responsible for managing the UI to present a challenge, whose digits can be selected, which are then duplicated
into the response. The response can be cleared, saved and restored (from save). There is also a cleanup handler to remove any DOM elements
created when you want to destroy a UserInterface instantiation.

The generalization of this class allows for the multiple use-cases.
For a front-end that houses both a password entry and password setup mode, we create two instances, but adjust the constructor parameters input so we can 
use them in different ways:
1) To present the challenge and challenge-selection. (password entry) 
2) To present the secret-space and secret-selection. (password setup)

Paramaters:
	docRoot - the DOM root node for the user interface. (usually just document.)

	challengeGridDim* - dimensions of challenge grid.
	challengeGridRes* - resolutions of each challenge grid digit (px).

	responseGridDim* - dimensions of challenge grid
	responseGridRes* - resolutions of each challenge grid digit (px).

	keyValInitHandler - a function pointer to init handlers to loookup and handler to apply the correct visual manipulations (I.e. shape, fg colour, border colour) to an SVG child element  (challenge digit) based on an attribute key-value pair.
	responseSizeMax - artificial maximum response size for UI.

	challengeSvgID - desired id for the SVG element that will be created by the challengeUI.
	challengePane - parent element to append the challenge SVG element to.

	responseSvgID - desired id for the SVG element that will be created by the challengeUI.
	responsePane - parent element to append the resonse SVG element to.

	responseCopySvgID - desired id for the SVG element that will be created by the challengeUI that is used to implement editing functions for the response.
	responseCopyPane - parent element to append the resonse copy SVG element to.
*/
class UserInterface {
	/*******************************************************************************
	CONSTRUCTOR and PRIVATE MEMEBERS
	*******************************************************************************/
	constructor(docRoot, 
				challengeGridDimX, challengeGridDimY, 
				challengeGridResX, challengeGridResY, 
				responseGridDimX, responseGridDimY, 
				responseGridResX, responseGridResY, 
				keyValInitHandler, keySize,
				valSize, responseSizeMax,
				challengeSvgID, challengePane,
				responseSvgID, responsePane,
				responseCopySvgID, responseCopyPane,
				overlayPane) {

		this.docRoot = docRoot; 
		this.challengeGridDimX = challengeGridDimX;
		this.challengeGridDimY = challengeGridDimY;
		this.challengeGridResX = challengeGridResX;
		this.challengeGridResY = challengeGridResY;
		this.responseGridDimX = responseGridDimX;
		this.responseGridDimY = responseGridDimY;
		this.responseGridResX = responseGridResX;
		this.responseGridResY = responseGridResY;
		this.keyValInitHandler = keyValInitHandler;
		this.keySize = keySize;
		this.valSize = valSize;
		this.responseSizeMax = responseSizeMax;
		this.challengeSvgID = challengeSvgID;
		this.challengePane = challengePane;
		this.responseSvgID = responseSvgID;
		this.responsePane = responsePane;
		this.responseCopySvgID = responseCopySvgID;
		this.responseCopyPane = responseCopyPane;
		this.overlayPane = overlayPane;
		this.overlayTimer;
		this.overlayTimeout = 500; //ms
		//this.overlayPane.style.width = challengeGridDimX * challengeGridResX;	

		this.challengeCopyCursor = 0;
		this.challengeCursor = 0;

		this.responseCopyCursor = 0;
		this.responseCursor = 0;

		this.challengeElementClassName = 'challengeElement';
		this.challengeDigitClassName = 'challengeDigit';
		this.ringElementClassName = 'challengeGrid';
		
		let [kvLookup, kvHandler] = keyValInitHandler(this, keySize, valSize);
		this.keyValLookup = kvLookup;
		this.keyValHandler = kvHandler;

		// We only need to generate the SVG parent containers once.
	    this.initSvgContainers();
		
	}

	initSvgContainers() {
		fatalError('ASSERT: Unimplemented "initSvgContainers" routine');
	}



    /*******************************************************************************
	PRIVILEGED
	*******************************************************************************/
	/*
	The UserInterface provides the following Public Services:
		Get new challenge
			- fill the challenge UI with new challenge.
		Clear resonse 
			- clear the response UI.
		load resonse 
			- load the previous response UI from the backup slot.
		store response 
			- store the current response UI to the backup slot.
		Cleanup 
			- This needs to be called before you destroy a UserInterface (no destructors in js). 
			- It removes elements that this class may have created in the DOM of that was passed into it (DOCROOT).
		Select challenge digit
			- This is a callback for when challenge digits are selected.
	*/

	cleanup () {
		if (this.overlayTimer)	clearTimeout(this.overlayTimer);
		this.overlayPane.style.display = 'none';

		this.challengeCopyCursor = 0;
		this.challengeCursor = 0;

		this.responseCopyCursor = 0;
		this.responseCursor = 0;

		this.challengePane.removeChild(this.challengeSvg);
		this.challengeSvg = null;
		
		this.responsePane.removeChild(this.responseSvg);
		this.responseSvg = null;
		
		this.responseCopyPane.removeChild(this.responseCopySvg);
		this.responseCopySvg = null;
	}

	clearResponseHandler () {
	    this.popSvg(this.responseSvg, 0);
	    this.responseCursor = 0;
	}

	loadResponseHandler  () {
		this.responseSvg = this.copySvg(this.responseSvg, this.responseCopySvg);
		this.responseCursor = this.responseCopyCursor;
	}

	storeResponseHandler () {
		this.responseCopySvg = this.copySvg(this.responseCopySvg, this.responseSvg);
		this.responseCopyCursor = this.responseCursor;
		return this.decodeSvg(this.responseSvg);
	}

	newChallengeHandler (challenge) {
		assfatalError('ASSERT: Unimplemented "newChallengeHandler" routine');
	}

	challengeDigitSelectHandler (evt) {
	    fatalError('ASSERT: Unimplemented "challengeDigitSelectHandler" routine');
	}

	/*******************************************************************************
	 PRIVATE
	*******************************************************************************/
	generateSvgDigits(dst, src, dimX, clickHandlerStr) {
	    fatalError('ASSERT: Unimplemented "generateSvgDigits" routine');
	}

	/* 
	This will generate and return an array of the child challenge elements of an svg SRC using it's "id" attribute).
	This is used as a numeric, intermediate-representation to communicate with an instantiation of BlackBox.
	*/
	decodeSvg(src) {
		var temp = src.getElementsByClassName(this.challengeDigitClassName);
	    var max = temp.length;
	    var output = new Array(max);
	    for (let i = 0; i < max; i++) {
	        output[i] = temp[i].id;
	    }
	    return output;
	}

	/* 
	Generate an SVG element using the dimensions, resolution, and "id" attribute value.
	Include a "use" child element so that we can use the shape definitions.
	*/
	generateSvgContainer(idStr, dimX, dimY, resX, resY) {
		var obj = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		obj.id = idStr;
		obj.setAttribute("width", (dimX * resX));
		obj.setAttribute("height", (dimY * resY));
		obj.setAttribute("viewBox","0 0 " + dimX + " " + dimY);

		
		return obj;
	}

	/* 
	This will draw a grid overlay to divide a rectandle into DIMX columns and DIMY
	rows. The caller can also specify to draw only certain line orientations.
	*/
	generateSvgGrid(dst, dimX, dimY, disableVertical, disableHorizontal) {
		if (!disableVertical) {
			for (let i = 0; i <= dimX; i++) {
		        var obj = document.createElementNS("http://www.w3.org/2000/svg", "line");
		        //obj.setAttribute("style", "stroke:rgb(255,255,255);stroke-width:.02");
		        obj.setAttribute("x1", i);
		        obj.setAttribute("x2", i);
		        obj.setAttribute("y1", "0");
		        obj.setAttribute("y2", dimY);
		        obj.setAttribute("class", this.challengeElementClassName);
		        dst.appendChild(obj);
		    }
		}

		if (!disableHorizontal) {
		    for (let i = 0; i <= dimY; i++) {
		        var obj = document.createElementNS("http://www.w3.org/2000/svg", "line");
		        //obj.setAttribute("style", "stroke:rgb(255,255,255);stroke-width:.02");
		        obj.setAttribute("x1", "0");
		        obj.setAttribute("x2", dimX);
		        obj.setAttribute("y1", i);
		        obj.setAttribute("y2", i);
		        obj.setAttribute("class", this.challengeElementClassName);
		        dst.appendChild(obj);
		    }
		}
    	return dst;
	}



	overlayPopup(msg) {
		if (this.overlayPane) {
			this.overlayPane.innerHTML = msg;
			this.overlayPane.style.display = 'block';
			var overlayElement = this.overlayPane; // pass through data to the timeout function
			this.overlayTimer = setTimeout(function () {
				overlayElement.style.display = 'none'; //if we use 'this' it loses scope when the timeout handler executes.
			}, this.overlayTimeout);
			/*
			this.overlayPaneonclick = function () { 
				clearTimeout(tm);
				overlayPane.style = 'none';
			};
			*/
		}
	}


	/* 
	Duplicate a SRC svg element overwriting an existing DST svg element.
	Caller is responsible for eliminating the reference(s) to dst upon return.
	The DST must be the child of *some* element.
	*/
	copySvg (dst, src) {
	    var tmp = src.cloneNode(true);
	    tmp.id = dst.id;

		if (dst && dst.parentNode) {
			dst.parentNode.insertBefore(tmp, dst.nextSibling); // appends to parent if dstSibling==null
			dst.parentNode.removeChild(dst);
	    } else {
	        fatalError("ASSERT: empty dst || parent on restoreSVG");
	        return null;
	    }
	    return tmp;
	}
	
	/* 
	Pop the first N challenge digits of the children of a SRC svg dom element into an array that is returned to the caller.
	It is up to the caller to deallocate the src, if desired.
	If N < 1, all child challenge digit elements are popped
	*/
	popSvg(src, n) {

		var tmp = src.getElementsByClassName(this.challengeElementClassName);
		var max = ((n < 1 || n > tmp.length) ? tmp.length : n);
		var output = new Array(max);
		// the array changes length at run-time, so we always reference the head 'tmp[0]', not the i'th 
		for (let i = 0; i < max; i ++) {
			if (!tmp[0])
				break; // we have removed all nodes
			output[i] = tmp[0];
			src.removeChild(tmp[0]);
		}
		return output;
	}
}