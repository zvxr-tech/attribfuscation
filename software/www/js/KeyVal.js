/* Constructor helper routine: initialize the keyVal* private members.
	We are realizing challenge digits as objects in an SVG element, which reflect the 
	attribute key-value pairs (where the keys and values map to real-world visual concepts).

	To simplify and decouple this, we first write a handler that will implement the visual effect of the key.
	For example, this controller uses "shape" as the first attribute, so we have the handler simply reference
	a pre-defined SVG shape, using the shape-name as input (here, OBJ is a reference to the SVG child element whose
	attribute we are setting):
		
		exampleHandler[key] = function (val, obj){
		    obj.setAttribute("href", '#' + val);
	    	return obj;		
		}
		
	, and we would invoke it,

		exampleHandler[0]("square",target)

	Note, the size of the handler array must equal the size of the keyspace.

	Using the values needed on that key,we then construct a key-value lookup table:
	
		keyValLookup[key_enum][val_enum] = value

	For example with shapes as key=0,
		keyValLookup[0][0] = "square"
		keyValLookup[0][1] = "diamond"
		...

	!!!!IMPORTANT NOTE!!!!
	
	The size of the lookup arrays first dimension should be the key size (smaller-sized dimensions will cause undefined results, larger will just be exluded internally by logic that depends on the keySize, not  keyValLookup[0].length).
	The size of the second dimension should be the attribute value set size + 1, for all. The first (extra inserted element) should contain a sentinel value that is never used in the challenge space and thus can 
	be used as a placeholder when trying to display a single, attribute key-value pair on an object composed of many key-value pairs. This is especially helpful when you want to display the entire secret-space visually.
	Or the keyVal handler routine can be written to completely ignore and not modify objects associated with val=0.
	For example,
		Suppose we have 2 attribute types (keys), each with two values they can take on: 0:shape={0:"square", 1:"diamond"} and 1:colour={0:"red", 1:"green"}.
		We would then choose a shape and colour not present in their respective sets, let's choose: "circle" for shape and "blue" for colour.
		We would then define,
			keyValLookup[0][0] = "circle"
			keyValLookup[0][1] = "square"
			keyValLookup[0][2] = "diamond"

			keyValLookup[1][0] = "blue"
			keyValLookup[1][1] = "red"
			keyValLookup[1][2] = "green"

	Then, if we wanted to illustrate the diamond attribute alone, we would have an object with the following key-value pairings,
		(K,V) = {(0,2), (1,0)}
	This would affect a blue diamond.


	The keyVal construct can easilly be extended by adding more handlers and lookup entries. In this example, the values were strings (because that was the most appropriate), however,
	nothing would prevent a developer from using objects or pushing more logic into the handler to process complex, expressive inputs to the handler.
*/
function initKeyValShapeColour(that, keySize, valSize) {
	var keySizeMax = 3;
	var valSizeMax = 9;

	if (keySize > 3)
		console.error('"KeyValShapeColour" does not support more than ' + keySizeMax + ' keys.')
	if (valSize > 9)
		console.error('"KeyValShapeColour" does not support more than ' + valSizeMax + ' values.')

	++valSize; // add room for a sentinal value @ index=0

	var keyValLookup = new Array(keySize);
	for (let i = 0; i < keySize; i++) {
	    keyValLookup[i] = new Array(valSize);
	}

	// shape
	if (keySize > 0) {
		keyValLookup[0][0] = 'five-star'; //sentinal value
		keyValLookup[0][1] = 'diamond';
		keyValLookup[0][2] = 'pentagon';
		keyValLookup[0][3] = 'hexagon';
		keyValLookup[0][4] = 'circle';
		keyValLookup[0][5] = 'triangle-up';
		keyValLookup[0][6] = 'triangle-down';
		keyValLookup[0][7] = 'triangle-right';
		keyValLookup[0][8] = 'triangle-left';
		keyValLookup[0][9] = 'square';
	}

	// fg colour
	if (keySize > 1) {
/*
		// 50%
		keyValLookup[1][9] = 'rgb(114,13,14)';
		keyValLookup[1][8] = 'rgb(27,63,92)';
		keyValLookup[1][7] = 'rgb(38,87,37)';
		keyValLookup[1][6] = 'rgb(76,39,81)';
		keyValLookup[1][5] = 'rgb(127,63,0)';
		keyValLookup[1][4] = 'rgb(127,127,25)';
		keyValLookup[1][3] = 'rgb(83,43,20)';
		keyValLookup[1][2] = 'rgb(123,64,95)';
		keyValLookup[1][1] = 'rgb(128,128,128)';
		//keyValLookup[1][1] = 'rgb(90,108,120)';
		//keyValLookup[1][1] = 'rgb(76,76,76)';
		keyValLookup[1][0] = 'grey'; //sentinal value

		// 75%
		keyValLookup[1][9] = 'rgb(171,19,21)';
		keyValLookup[1][8] = 'rgb(41,94,138)';
		keyValLookup[1][7] = 'rgb(57,131,55)';
		keyValLookup[1][6] = 'rgb(114,58,122)';
		keyValLookup[1][5] = 'rgb(191,95,0)';
		keyValLookup[1][4] = 'rgb(191,191,38)';
		keyValLookup[1][3] = 'rgb(124,64,30)';
		keyValLookup[1][2] = 'rgb(185,96,143)';
		keyValLookup[1][1] = 'rgb(191,191,191)';
		//keyValLookup[1][1] = 'rgb(134,161,178)';
		//keyValLookup[1][1] = 'rgb(114,114,114)';
		keyValLookup[1][0] = 'grey'; //sentinal value
*/


		// 90%
		keyValLookup[1][9] = 'rgb(205,23,25)';
		keyValLookup[1][8] = 'rgb(49,113,165)';
		keyValLookup[1][7] = 'rgb(69,157,66)';
		keyValLookup[1][6] = 'rgb(136,70,146)';
		keyValLookup[1][5] = 'rgb(229,114,0)';
		keyValLookup[1][4] = 'rgb(229,229,45)';
		keyValLookup[1][3] = 'rgb(149,77,36)';
		keyValLookup[1][2] = 'rgb(222,116,171)';
		keyValLookup[1][1] = 'rgb(230,230,230)';
		//keyValLookup[1][1] = 'rgb(161,194,215)';
		//keyValLookup[1][1] = 'rgb(137,137,137)';
		keyValLookup[1][0] = 'grey'; //sentinal value
/*
		// 100%
		keyValLookup[1][9] = 'rgb(228,26,28)';
		keyValLookup[1][8] = 'rgb(55,126,184)';
		keyValLookup[1][7] = 'rgb(77,175,74)';
		keyValLookup[1][6] = 'rgb(152,78,163)';
		keyValLookup[1][5] = 'rgb(255,127,0)';
		keyValLookup[1][4] = 'rgb(255,255,51)';
		keyValLookup[1][3] = 'rgb(166,86,40)';
		keyValLookup[1][2] = 'rgb(247,129,191)';
		keyValLookup[1][1] = 'rgb(179,205,227)';
		//keyValLookup[1][1] = 'rgb(153,153,153)';
		keyValLookup[1][0] = 'grey'; //sentinal value

////////////////////////////////////			
		// 75% lightness
		keyValLookup[1][0] = 'grey'; //sentinal value
		keyValLookup[1][1] = 'rgb(192,0,0)'; // red
		keyValLookup[1][2] = 'rgb(0,192,0)'; // green
		keyValLookup[1][3] = 'rgb(0,0,192)'; //blue
		keyValLookup[1][4] = 'rgb(192,192,0)'; //yellow
		keyValLookup[1][5] = 'rgb(104,51,14)'; //brown
		keyValLookup[1][6] = 'rgb(192,0,192)'; // magenta
		keyValLookup[1][7] = 'rgb(0,192,192)'; //cyan
		keyValLookup[1][8] = 'rgb(192, 192, 192)'; // white
		keyValLookup[1][9] = 'rgb(183, 97, 36)'; // organge

		// 90% lightness
		keyValLookup[1][0] = 'grey'; //sentinal value
		keyValLookup[1][1] = 'rgb(230,0,0)'; // red
		keyValLookup[1][2] = 'rgb(0,230,0)'; // green
		keyValLookup[1][3] = 'rgb(0,0,230)'; //blue
		keyValLookup[1][4] = 'rgb(230,230,0)'; //yellow
		keyValLookup[1][5] = 'rgb(125,62,17)'; //brown
		keyValLookup[1][6] = 'rgb(230,0,230)'; // magenta
		keyValLookup[1][7] = 'rgb(0,230,230)'; //cyan
		keyValLookup[1][8] = 'rgb(230, 230, 230)'; // white
		keyValLookup[1][9] = 'rgb(220, 117, 43)'; // organge

		keyValLookup[1][0] = 'grey'; //sentinal value
		keyValLookup[1][1] = 'rgb(255,0,0)'; // red
		keyValLookup[1][2] = 'rgb(0,255,0)'; // green
		keyValLookup[1][3] = 'rgb(0,0,255)'; //blue
		keyValLookup[1][4] = 'rgb(255,255,0)'; //yellow
		keyValLookup[1][5] = 'rgb(139,69,19)'; //brown
		keyValLookup[1][6] = 'rgb(255,0,255)'; // magenta
		keyValLookup[1][7] = 'rgb(0,255,255)'; //cyan
		keyValLookup[1][8] = 'rgb(255, 255, 255)'; // white
		keyValLookup[1][9] = 'rgb(245, 130, 48)'; // organge
		
		keyValLookup[1][0] = 'grey'; //sentinal value
		keyValLookup[1][1] = 'green';
		keyValLookup[1][2] = 'blue';
		keyValLookup[1][3] = 'brown';
		keyValLookup[1][4] = 'red';
		keyValLookup[1][5] = 'yellow';
		keyValLookup[1][6] = 'orange';
		keyValLookup[1][7] = 'pink';
		keyValLookup[1][8] = 'cyan';
		keyValLookup[1][9] = 'white';
		*/
	}

	// stroke colour
	if (keySize > 2) {

		// 100%
		keyValLookup[2][9] = 'rgb(228,26,28)';
		keyValLookup[2][8] = 'rgb(55,126,184)';
		keyValLookup[2][7] = 'rgb(77,175,74)';
		keyValLookup[2][6] = 'rgb(152,78,163)';
		keyValLookup[2][5] = 'rgb(255,127,0)';
		keyValLookup[2][4] = 'rgb(255,255,51)';
		keyValLookup[2][3] = 'rgb(166,86,40)';
		keyValLookup[2][2] = 'rgb(247,129,191)';
		keyValLookup[2][1] = 'rgb(255,255,255)';
		//keyValLookup[2][1] = 'rgb(179,205,227)';
		//keyValLookup[2][1] = 'rgb(153,153,153)';
		keyValLookup[2][0] = 'grey'; //sentinal value
		
		/*
		keyValLookup[2][0] = 'grey'; //sentinal value
		keyValLookup[2][1] = 'rgb(255,0,0)'; //red
		keyValLookup[2][2] = 'rgb(0,255,0)'; //green
		keyValLookup[2][3] = 'rgb(0,0,255)'; //blue
		keyValLookup[2][4] = 'rgb(255,255,0)'; //yellow
		keyValLookup[2][5] = 'rgb(139,69,19)'; //brown
		keyValLookup[2][6] = 'rgb(255,0,255)'; //magenta
		keyValLookup[2][7] = 'rgb(0,255,255)'; //cyan
		keyValLookup[2][8] = 'rgb(255, 255, 255)'; // white
		keyValLookup[2][9] = 'rgb(245, 130, 48)'; //orange
		//keyValLookup[2][9] = 'white';
		
		keyValLookup[2][0] = 'grey'; //sentinal value
		keyValLookup[2][1] = 'green';
		keyValLookup[2][2] = 'blue';
		keyValLookup[2][3] = 'brown';
		keyValLookup[2][4] = 'red';
		keyValLookup[2][5] = 'yellow';
		keyValLookup[2][6] = 'orange';
		keyValLookup[2][7] = 'pink';
		keyValLookup[2][8] = 'cyan';
		keyValLookup[2][9] = 'white';
		*/
	}

	var keyValHandler = new Array(keySize);
	keyValHandler[0] = function (val, obj){
		if (!obj)	obj = document.createElementNS('http://www.w3.org/2000/svg', 'use');
		if (!obj.getAttribute('fill'))	obj.setAttribute('fill', 'grey');
			
	    obj.setAttribute('href', '#' + val);
	    return obj;
	}

	keyValHandler[1] = function (val, obj){
		if (!obj) obj = document.createElementNS('http://www.w3.org/2000/svg', 'use');
	    obj.setAttribute('fill', val);
	    return obj;
	}

	keyValHandler[2] = function (val, obj){
		if (!obj) obj = document.createElementNS('http://www.w3.org/2000/svg', 'use');
	    obj.setAttribute('style','stroke:'+val+';stroke-width:.1');
	    return obj;
	}
	return [keyValLookup, keyValHandler];
}
         
function initKeyValNumericGrid(that, keySize, valSize) {
	//var keySize = 1;
	//var valSize = 9;

	++valSize; // add room for a sentinal value @ index=0

	var keyValLookup = new Array(keySize);
	for (let k = 0; k < keySize; k++) {
	    keyValLookup[k] = new Array(valSize);
	}

    for (let k = 0; k < keySize; k++) {
    	for (let v = 0; v < valSize; v++) {
			keyValLookup[k][v] = v.toString();
		}
	}
	
	var keyValHandler = new Array(keySize);
	for (let k = 0; k < keySize; k++) {
		keyValHandler[k] = function (val, obj){
			if (!obj) obj = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	        if (val != 0) { 
		    	obj.innerHTML = val;
				obj.setAttribute("font-size", "0.8");
		        obj.setAttribute('font-family', 'sans-serif');
		        obj.setAttribute('fill', 'white');
		    }
	    	return obj;
		}
	}
	return [keyValLookup, keyValHandler];
}

function initKeyValNumericDial(that, keySize, valSize) {
	//var keySize = 3;
	//var valSize = 8;

	++valSize; // add room for a sentinal value @ index=0

	var keyValLookup = new Array(keySize);
	for (let k = 0; k < keySize; k++) {
	    keyValLookup[k] = new Array(valSize);
	}

    for (let k = 0; k < keySize; k++) {
    	for (let v = 0; v < valSize; v++) {
			keyValLookup[k][v] = v.toString();
		}
	}
	
	var keyValHandler = new Array(keySize);
	for (let k = 0; k < keySize; k++) {
		keyValHandler[k] = function (val, obj){

			if (!obj) obj = document.createElementNS('http://www.w3.org/2000/svg', 'text');

		    if (val != 0)
		    	obj.innerHTML = val;
	    	return obj;
		}
	}
	return [keyValLookup, keyValHandler];
}