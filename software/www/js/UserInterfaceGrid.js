class UserInterfaceGrid extends UserInterface {
	/* Arguments to UserInterface superclass:
	(docRoot, 
	challengeGridDimX, challengeGridDimY, 
	challengeGridResX, challengeGridResY, 
	responseGridDimX, responseGridDimY, 
	responseGridResX, responseGridResY, 
	keyValInitHandler, keySize,
	valSize, responseSizeMax,
	challengeSvgID, challengePane,
	responseSvgID, responsePane,
	responseCopySvgID, responseCopyPane)
	*/
	constructor (...args) {
		super(...args);
	}

	initSvgContainers() {
		// We only need to generate the SVG parent containers once.
	    this.challengeSvg = this.generateSvgContainer(this.challengeSvgID, this.challengeGridDimX, this.challengeGridDimY, this.challengeGridResX, this.challengeGridResY);
	    this.challengePane.appendChild(this.challengeSvg);

	    this.responseSvg = this.generateSvgContainer(this.responseSvgID, this.responseGridDimX, this.responseGridDimY, this.responseGridResX, this.responseGridResY);
	    this.responsePane.appendChild(this.responseSvg);

	    this.responseCopySvg = this.generateSvgContainer(this.responseCopySvgID, this.responseGridDimX, this.responseGridDimY, this.responseGridResX, this.responseGridResY);
	    this.responseCopyPane.appendChild(this.responseCopySvg);
	}
	
	/*******************************************************************************
	 PUBLIC
	*******************************************************************************/
	newChallengeHandler(challenge) {
		this.popSvg(this.challengeSvg, 0);
		this.generateSvgGrid(this.challengeSvg, this.challengeGridDimX, this.challengeGridDimY);
		this.generateSvgDigits(this.challengeSvg, challenge, this.challengeGridDimX);
	}


	challengeDigitSelectHandler(evt) {
	    if (this.responseCursor >= this.responseSizeMax) {
	        console.log('Response is artificially limited to a maximum length of ' + this.responseSizeMax);
	        this.overlayPopup('<br /><h2  style=" background: black; opacity: 1.0; color:red;">Max length!</h2>');
	    } else {
	        var dupNode = this.challengeSvg.getElementById(evt.target.id).cloneNode(true);
	        // patch up the x and y positions relative for the new svg container, remove event handler
	        dupNode.setAttribute('x', Math.floor(this.responseCursor % this.responseGridDimX ));
	        dupNode.setAttribute('y', Math.floor(this.responseCursor / this.responseGridDimX ));
	        dupNode.setAttribute('onclick','');
	        dupNode.setAttribute('class', dupNode.getAttribute('class') + ' ' + this.challengeDigitClassName);
	        this.responseSvg.appendChild(dupNode);
	        ++this.responseCursor;
	    }
	}

	/*******************************************************************************
	 PRIVATE
	*******************************************************************************/

	/* 
	Generate an SVG element using the dimensions, resolution, and 'id' attribute value.
	Include a 'use' child element so that we can use the shape definitions.

		args: idStr, dimX, dimY, resX, resY
	*/
	generateSvgContainer(...args) {

		var obj = super.generateSvgContainer(...args);
		var obj2 = document.createElementNS('http://www.w3.org/2000/svg', 'use');
		obj2.setAttribute('href','#svgShapes');
		obj.appendChild(obj2);

		return obj;
	}

	/* Generate an SVG child element for each numeric element of the array SRC, where
		the value of the numeric array element is used as the id attribute of the
		new svg element spawned. The SVG child element will have the attributes
		key-value's associated with it applied by calling the associated attribute transformation handler.
		(This could do things like change the foreground colour based on some lookup table; or change the shape being rendered.)

		The Svg child elements are appended as children to the DST dom element in
		the same order as SRC. 

		We need to append *all* of the svg text elements *before* appending the bounding clickboxes,
		otherwise the text elements errornously large bounding box will interfere with click events firing

	*/
	generateSvgDigits(dst, src, dimX) {
	    for (var id = 0; id < src.length; id++) {
	        let element = src[id];
	        // get co-ordinates of challenge element using the id
			let [row, col] = [Math.floor(id / dimX), Math.floor(id % dimX)];
			var obj = null;			

	        for (var key = 0; key < element.length; key++) {
	            var val = element[key];
	            obj = this.keyValHandler[key](this.keyValLookup[key][val], obj);
	        }
			
	        obj.setAttribute('x', col);
	        obj.setAttribute('y', row);
	        obj.setAttribute('class', this.challengeElementClassName);
	        obj.setAttribute('id', id);
			obj.innerHTML = '&nbsp;' + obj.innerHTML; // styling hack for numerals
	        dst.appendChild(obj);
	    }


	    for (var id = 0; id < src.length; id++) {
			let [row, col] = [Math.floor(id / dimX), Math.floor(id % dimX)];
			var obj = null;		
	        // create bounding box (b/c for svg text elements, the bounding box is not being calculated automatically correctly)
	        obj = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	        obj.setAttribute('x', col + 0.1);
	        obj.setAttribute('y', row + 0.1);
	        obj.setAttribute('width', '0.8');
	        obj.setAttribute('height', '0.8');
	        obj.setAttribute('height', '0.8');

			obj.setAttribute('style', 'fill:rgb(200,0,0);stroke-width:0.2;stroke:rgb(0,200,0)');
	        obj.setAttribute('opacity', '0');
	        obj.setAttribute('class', this.challengeElementClassName);
	        obj.setAttribute('id', id);
	        var _that = this;
	        obj.addEventListener('click', function (evt) { return _that.challengeDigitSelectHandler(evt); });
;
	        dst.appendChild(obj);
	        
	    }
	    return dst;
	}
}