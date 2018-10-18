class UserInterfaceDialSecret extends UserInterface {
	/* Arguments to UserInterface superclass:
	docRoot, 
	challengeGridDimX, challengeGridDimY, 
	challengeGridResX, challengeGridResY, 
	responseGridDimX, responseGridDimY, 
	responseGridResX, responseGridResY, 
	keyValInitHandler, keySize,
	valSize, responseSizeMax,
	challengeSvgID, challengePane,
	responseSvgID, responsePane,
	responseCopySvgID, responseCopyPane,
	overlayPane
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
		this.generateSvgGrid(this.challengeSvg, this.challengeGridDimX, this.challengeGridDimY, false, false);
		this.generateSvgGrid(this.responseSvg, this.responseGridDimX, this.responseGridDimY, true. false); // draw only lin horizontales 
		this.generateSvgDigits(this.challengeSvg, challenge, this.challengeGridDimX);
	}

	challengeDigitSelectHandler(evt) {
	    if (this.responseCursor >= this.responseSizeMax) {
	        console.log('Response is artificially limited to a maximum length of ' + this.responseSizeMax);
	        this.overlayPopup('<br /><h1  style=" background: black; opacity: 1.0 ; color:red;">Repsonse is limited to a length of ' + this.responseSizeMax + '!</h1>');
	    } else {
	        var dupNode = this.challengeSvg.getElementById(evt.target.id).cloneNode(true);
	        // patch up the x and y positions relative for the new svg container, remove event handler
	        dupNode.setAttribute('x', Math.floor(this.responseCursor % this.responseGridDimX ));
	        dupNode.setAttribute('class', dupNode.getAttribute('class') + ' ' + this.challengeDigitClassName);
	        dupNode.setAttribute('onclick','');
	        dupNode.setAttribute('fill', 'white');
	        dupNode.setAttribute('font-family', 'sans-serif');
	        this.responseSvg.appendChild(dupNode);
	        ++this.responseCursor;
	    }
	}
	
	/*******************************************************************************
	 PRIVATE
	*******************************************************************************/	
	/* Generate an SVG child element for each numeric element of the array SRC, where
	the value of the numeric array element is used as the id attribute of the
	new svg element spawned. The SVG child element will have the attributes
	key-value's associated with it applied by calling the associated attribute transformation handler.
	(This could do things like change the foreground colour based on some lookup table; or change the shape being rendered.)

	The Svg child elements are appended as children to the DST dom element in
	the same order as SRC. 
	*/
	generateSvgDigits(dst, src, dimX) {
	    for (var id = 0; id < src.length; id++) {
	        let element = src[id];

	        // get co-ordinates of challenge element using the id
			let [row, col] = [Math.floor(id / dimX), Math.floor(id % dimX)];
			var obj = null;	
			let val = -1;
	        for (var key = 0; key < element.length; key++) {
	            val = element[key];
	            obj = this.keyValHandler[key](this.keyValLookup[key][val], obj);
	        }
	        
	        obj.setAttribute('x', col);
	        obj.setAttribute('dx', 0.5);
	        obj.setAttribute('y', row);
	        obj.setAttribute('y', row);
	        obj.setAttribute('dy', 0.5);
	        obj.setAttribute('class', this.challengeElementClassName);
	        obj.setAttribute('id', id);
	        obj.setAttribute("font-size", "0.8");
	        obj.setAttribute('font-family', 'sans-serif');
	        obj.setAttribute('fill', 'white');
			
			var _that = this;
			obj.addEventListener('click', function (evt) { return _that.challengeDigitSelectHandler(evt); });

	        dst.appendChild(obj);
	    }
	    return dst;
	}
}