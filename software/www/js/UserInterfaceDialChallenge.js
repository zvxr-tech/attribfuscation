class UserInterfaceDialChallenge extends UserInterface {
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
	
		this.mousemoveStartFlag = 1;
		this.animationTimer = null;

	    var _that = this;

	    this.challengePane.addEventListener('mouseup', function (evt) {
	    	_that.settle(_that);
			_that.mousemoveStartFlag = 1;
	    });

	    this.challengePane.addEventListener('mousemove', function (evt) {
	    	if (evt.buttons & 0x1) { // LEFT mouse button
				if (_that.mousemoveStartFlag) {
					_that.mousemoveStartFlag = 0;
				}
				
				if (evt.movementY > 0) {
					_that.challengeCursor += Math.ceil(evt.movementY / 2);
				} else {
					_that.challengeCursor += Math.floor(evt.movementY / 2);
				}
				
				_that.transformDial();
			}
		});

	    this.challengePane.addEventListener('mousedown', function(evt) {
			clearTimeout(_that.animationTimer);
			_that.challengeCursor = _that.challengeCopyCursor;
			_that.transformDial();
    	});

		this.g_challengeDigit = 0;
	}
	
	initSvgContainers() {	    
	    this.challengeSvg = this.generateSvgContainer(this.challengeSvgID, this.challengeGridDimY * 2 + 1, this.challengeGridDimY * 2 + 1, this.challengeGridResY, this.challengeGridResY);
	    this.challengePane.appendChild(this.challengeSvg);

	    this.responseSvg = this.generateSvgContainer(this.responseSvgID, this.responseGridDimX, this.responseGridDimY, this.responseGridResX, this.responseGridResY);
	    this.responsePane.appendChild(this.responseSvg);

	    this.responseCopySvg = this.generateSvgContainer(this.responseCopySvgID, this.responseGridDimX, this.responseGridDimY, this.responseGridResX, this.responseGridResY);
	    this.responseCopyPane.appendChild(this.responseCopySvg);
	}

	/*******************************************************************************
	 "PUBLIC" Routines
	*******************************************************************************/
	newChallengeHandler(challenge) {
		this.challengeCursor = 0;
		this.challengeCopyCursor = 0;
		this.popSvg(this.challengeSvg, 0);
		this.generateSvgGrid(this.responseSvg, this.challengeGridDimX, this.challengeGridDimY, true, false); // draw only horizontal lines 
		let digitsSvg = this.generateSvgDial(this.challengeSvg, this.challengeGridDimX, this.challengeGridDimY); 
		this.generateSvgDigits(digitsSvg, challenge, this.challengeGridDimX);
	}

	challengeDigitSelectHandler(evt) {
	    if (this.responseCursor >= this.responseSizeMax) {
	        console.log('Response is artificially limited to a maximum length of ' + this.responseSizeMax);
	        this.overlayPopup('<br /><h2  style=" background: black; opacity: 1.0 ;color:red;">Max length!</h2>');
	    } else {   
			var nodes = this.challengeSvg.getElementsByClassName('digit' + this.g_challengeDigit);
			
			
			for (var i = 0; i < nodes.length; i++) {
				var k = nodes.length - 1 - i;
				var dupNode = nodes[k].cloneNode(true);

		        dupNode.setAttribute('font-size', '1.0');
		        dupNode.setAttribute('fill', 'white');
		        dupNode.setAttribute('font-family', 'sans-serif');
	        
		        dupNode.setAttribute('onclick','');
				// patch up the x and y positions relative for the new svg container, remove event handler
		        dupNode.setAttribute('x', Math.floor(this.responseCursor % this.responseGridDimX ));
		        dupNode.setAttribute('y', i % this.responseGridDimY);
				
				// when we decode this svg, we only want to parse one of each digit.
				// we use the challengeDigitClassName to distinguish only the first element.
		        if (i == 0) {
					dupNode.setAttribute('class', dupNode.getAttribute('class') + ' ' + this.challengeDigitClassName);
		        }

		        this.responseSvg.appendChild(dupNode);
		    }
		    ++this.responseCursor;
	    }
	}	

	/*******************************************************************************
	 SVG Routines
	*******************************************************************************/
	transformDial() {
		var elems = this.docRoot.querySelectorAll('[id^=group]');
		for (var i = 0, len = elems.length; i < len; i++){
			if (i % 2)
				elems[i].setAttribute('transform', 'rotate(' + (this.challengeCursor * -1) +' 0 0)');
			else 
    			elems[i].setAttribute('transform', 'rotate(' + (this.challengeCursor) +' 0 0)');
    	}
	}

	/* 
	This will draw a grid overlay for reference, then proceed to draw concentric circles and a current digit selected overlay.
	This should return the svg parent to render challenge elements.
	*/
	generateSvgDial(dst, dimX, dimY) {
		var centerCoord = ((2 * dimY + 1)/2);
		var centerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		centerGroup.setAttribute('transform', 'translate(' + centerCoord + ',' + centerCoord + ')');
		centerGroup.setAttribute('class', this.challengeElementClassName);
		var r = 1;

		var groupSvg = new Array(dimY);

	    // concentric circles
	    for (let i = dimY - 1; i >= 0; i--) {
	        groupSvg[i] = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			groupSvg[i].setAttribute('id', 'group'+ i);
			groupSvg[i].setAttribute('class', this.ringElementClassName + ' ' + this.hallengeElementClassName);

	        var obj = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
	        obj.setAttribute('style', 'stroke:rgb(255,255,200);stroke-width:0.95');
	        obj.setAttribute('fill', 'black');
	        obj.setAttribute('r', i + 1);
	        obj.setAttribute('cx', 0);
	        obj.setAttribute('cy', 0);
	        obj.setAttribute('id','circle' + i);
	        obj.setAttribute('class', this.challengeElementClassName);
	        groupSvg[i].appendChild(obj);
	    }

	    for (let i = groupSvg.length - 1; i >= 0; i--)
			centerGroup.appendChild(groupSvg[i]);

	    r = dimY + 0.5;
		// segment lines
		/*
		for (let i = 0; i < dimX; i ++ 7) {
			var theta = (i / dimX)  + (1 / (2 * dimX));// + (1 / (2 * dimX));
			var x = r * Math.cos(2 * Math.PI * theta);
			var y = r * Math.sin(2 * Math.PI * theta);
	        var obj = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	        obj.setAttribute('style', 'stroke: red;stroke-width:.05');
	        obj.setAttribute('x1', 0);
	        obj.setAttribute('y1', 0);
	        obj.setAttribute('x2', x);
	        obj.setAttribute('y2', y);
	        obj.setAttribute('class', this.challengeElementClassName);
	        obj.setAttribute('id', i);
	        centerGroup.appendChild(obj);
	    }
	    */
		for (let i = 0; i < dimX; i += (dimX == 1 ? 1: dimX - 1)) {
			var theta = (i / dimX)  + (1 / (2 * dimX));// + (1 / (2 * dimX));
			var x = r * Math.cos(2 * Math.PI * theta);
			var y = r * Math.sin(2 * Math.PI * theta);
	        var obj = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	        obj.setAttribute('style', 'stroke: red;stroke-width:.05');
	        obj.setAttribute('x1', 0);
	        obj.setAttribute('y1', 0);
	        obj.setAttribute('x2', x);
	        obj.setAttribute('y2', y);
	        obj.setAttribute('class', this.challengeElementClassName);
	        obj.setAttribute('id', 'segment-line' +i);
	        centerGroup.appendChild(obj);
	    }


	    // grid lines (un-comment this to provide a grid background that is useful for tweaking positioning)
	 //    for (let i = -6; i < 7; i++) {
  // 			var obj = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	 //        obj.setAttribute('style', 'stroke: black;stroke-width:.01');
	 //        obj.setAttribute('x1', i);
	 //        obj.setAttribute('y1', -6);
	 //        obj.setAttribute('x2', i);
	 //        obj.setAttribute('y2', 6);
	 //        centerGroup.appendChild(obj);
	 //    }

		// for (let i = -6; i < 7; i++) {
  // 			var obj = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	 //        obj.setAttribute('style', 'stroke: black;stroke-width:.01');
	 //        obj.setAttribute('x1', -6);
	 //        obj.setAttribute('y1', i);
	 //        obj.setAttribute('x2', 6);
	 //        obj.setAttribute('y2', i);
	 //        centerGroup.appendChild(obj);
	 //    }

	    // create an inner circle as a button
	    var obj = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        //obj.setAttribute('style', 'stroke:rgb(255,255,200);stroke-width:1');
        obj.setAttribute('fill', 'red');
        obj.setAttribute('r',  0.5);
        obj.setAttribute('cx', 0);
        obj.setAttribute('cy', 0);
        obj.setAttribute('id','challengeDigitSelectButton');
        obj.setAttribute('class', this.challengeElementClassName);
        var _that = this;
	    obj.addEventListener('click', function (evt) { return _that.challengeDigitSelectHandler(evt); });


		centerGroup.appendChild(obj);
	    dst.appendChild(centerGroup);
    	return dst;
	}
	
	/* Generate an SVG child element for each numeric element of the array SRC, where
		the value of the numeric array element is used as the id attribute of the
		new svg element spawned. The SVG child element will have the attributes
		key-value's associated with it applied by calling the associated attribute transformation handler.
		(This could do things like change the foreground colour based on some lookup table; or change the shape being rendered.)

		The Svg child elements are appended as children to the DST dom element in
		the same order as SRC. 
	*/
	generateSvgDigits(dst, src, dimX) {
		var digitLength = src.length;
		var keyLength = src[0].length;

		// get references to the ring group elements
		var groupSvg = dst.getElementsByClassName(this.ringElementClassName);
		
		for (let key = 0; key < keyLength; key++) {
			for (let digit = 0; digit < digitLength; digit++) {
				var theta = (digit / dimX);
				var r = key + 1;	
				var x = r * Math.cos(2 * Math.PI * theta);
				var y = r * Math.sin(2 * Math.PI * theta);
				let actualDigit = ((((keyLength + key) % 2) != 0) ? digit : (digit == 0 ? 0 : digitLength - digit));
				var val = src[actualDigit][key];
				var obj = null;

				obj = this.keyValHandler[key](this.keyValLookup[key][val], obj);
				obj.setAttribute('x', x);
		        obj.setAttribute('y', y);
		        obj.setAttribute('class', this.challengeElementClassName + ' digit' + actualDigit);
		        obj.setAttribute('id', actualDigit);
		        obj.setAttribute("font-size", "0.8");
		        obj.setAttribute('font-family', 'sans-serif');
		        obj.setAttribute('fill', 'black');
		        
		        groupSvg[keyLength - 1 - key].appendChild(obj);
			}
		}
	    return dst;
	}

	/*******************************************************************************
	 Animation Routines
	*******************************************************************************/
	animateSettle(that) {
		if (Math.abs(that.challengeCopyCursor - that.challengeCursor) > 1) {
			that.challengeCursor += (that.challengeCopyCursor - that.challengeCursor) * 0.10;
			that.animationTimer = setTimeout(that.animateSettle, 1, that);
		} else {
			that.challengeCursor = that.challengeCopyCursor;
			clearTimeout(that.animationTimer);
		}

    	that.transformDial()
	}

	settle(that) {
		var theta = 360 / that.challengeGridDimX;
		var offset = that.challengeCursor % theta;
		var absOffset = Math.abs(offset);
		
			
			// go to previous spot
		that.challengeCopyCursor = that.challengeCursor - offset;

		if (offset == absOffset) {
			if (offset > (theta / 2)) 
				that.challengeCopyCursor += theta;			
		} else {
			if (offset < (theta / -2)) 
				that.challengeCopyCursor -= theta;			
		}
		
		that.g_challengeDigit = (that.challengeGridDimX - ((that.challengeCopyCursor / theta) + that.challengeGridDimX) % that.challengeGridDimX) % that.challengeGridDimX;
		that.challengeCopyCursor %= 360;
		clearTimeout(that.animationTimer);
		that.animationTimer = setTimeout(that.animateSettle, 1, that);
	}
}