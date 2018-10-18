/*
Attribfuscator - Telemeter class
Mike Clark - 2017

This class will record mouse movements over the document body,
as well as record actions (mouse clicks) on certain objects and allows for 
other modules/classes to log events with the logEvent interface this class exposes.

- use separate log files to avoid having to deal with concurrency issues.
- possible race condition on two events fired sequentially but being handled out of order,
 or worse, interleaving the conentes of the packets (corrupting them) -- NOT OBSERVED.


Timestamps
All recorded data is timestamped using 4 bytes laid out in two, 2-byte blocks (little-endian).
All timestamps except for event type EVENT_TY_ACTIVATION (42) and EVENT_TY_DEACTIVATION (43) use a consistant
source for the time measurement. Event type 42 and 43 use the lower 4 bytes of a unix timestamp, but can
be cross-referenced with EVENT_TY_ACTIVATIONCHANGE (44) (which occurs at the ~ same time as event 42 and again for event 43)
to relate the two time domains.


This is also true for some click() events that are triggerred by non-mouse (I.e. pressing the 'enter' key on a focused button')

To resolve this we re-stamp these events upon receipt so they are in the same time domain as the other records. The only downside
is that this can introduce up to 5ms of latency in the restamped measurements.

See format.txt file for the data specificactions.
*/


class Telemeter {
	
	
	constructor(docRoot) {
		this.version = 1;

		this.isActive = false;
		this.firstRun = true;

		this.docRoot = docRoot;

		/* Enumeration of action and event types */
		this.ACTION_TY_ERROR = 0;
		this.ACTION_TY_DIGIT = 1;
		this.ACTION_TY_OTHER = 2;
		
		this.EVENT_TY_ERROR = 0;
		this.EVENT_TY_NEWSECRET = 11;
		this.EVENT_TY_NEWCHALLENGE = 12;
		this.EVENT_TY_SUBMIT = 13;
		this.EVENT_TY_RESPONSECLEAR = 14
		this.EVENT_TY_ACTIVATION = 42;
		this.EVENT_TY_DEACTIVATION = 43;
		this.EVENT_TY_ACTIVATIONCHANGE = 44;
		this.EVENT_TY_OTHERDATA = 45;
		this.EVENT_TY_TIMESYNC = 46;
		this.EVENT_TY_CTLRESET = 47;
		
		this.BUFFER_TY_TELE = 1;
		this.BUFFER_TY_ACTION = 2;		
		this.BUFFER_TY_EVENT = 3;
		

		//FUTURE - alot of these can be replaced with BYTES_PER_ELEMENT ... etc..


		// 32 MB allows for the capture of 4,194,304 8-byte records.
		// Liberally assuming 1 event per ms, this will span just under 1 hour and 10 minutes
		this.TELE_BUFFER_BSIZE_MAX = 1024 * 1024 * 1;  // 32 MB
		this.ACTION_BUFFER_BSIZE_MAX = 1024 * 3 //1024 * 1; // 4 MB 
		this.EVENT_RECORD_COUNT_MAX = 1024 * 1024; // ~ ? MB
		
		
		/* Telemetry Buffer Setup 
		We want to record the x and y coordinates of the mouse cursor, relative to the current page.
		We want to associate this with a timestamp, we cheat by using only the lower 32 bits, which should not affect us
		since each telemetry aquisition should take no more than an hour.

		We use 32 bits for alignment purposes.
		*/
		this.TELE_RECORD_SIZE = 4;  // size (in units of Buffer View) of each record being stored
		this.TELE_FIELD_BSIZE = 2;  // if this value is modified, change typed array instantiation below (BYTES)
		this.TELE_RECORD_BSIZE = this.TELE_RECORD_SIZE * this.TELE_FIELD_BSIZE;
		if ((this.TELE_BUFFER_BSIZE_MAX % this.TELE_RECORD_BSIZE) != 0) {
			fatalError('ASSERT: TELE_BUFFER_BSIZE_MAX must be aligned with the byte size of each record.');
			return false;
		}
		
		this.teleBuffer = new ArrayBuffer(this.TELE_BUFFER_BSIZE_MAX);	
		this.teleBufferView16 = new Uint16Array(this.teleBuffer);
		this.teleViewIndex = 0; 
		
		
		
		/* Action Buffer Setup
        We want to record the x and y coordinates of the mouse cursor, relative to the current page.
        We want to associate this with a timestamp, we cheat by using only the lower 32 bits, which should not affect us
        since each telemetry aquisition should take no more than an hour.
        We also record a record type and record data

        We use 32 bits for alignment purposes.
        */
        this.ACTION_RECORD_SIZE = 6;  // size (in units of Buffer View) of each record being stored
        this.ACTION_FIELD_BSIZE = 2;  // if this value is modified, change typed array instantiation below (BYTES)
        this.ACTION_RECORD_BSIZE = this.ACTION_RECORD_SIZE * this.ACTION_FIELD_BSIZE;
        if ((this.ACTION_BUFFER_BSIZE_MAX % this.ACTION_RECORD_BSIZE) != 0) {
            fatalError('ASSERT: ACTION_BUFFER_BSIZE_MAX must be aligned with the byte size of each record.');
            return false;
        }
	
		this.actionBuffer = new ArrayBuffer(this.ACTION_BUFFER_BSIZE_MAX);
		this.actionBufferView16 = new Uint16Array(this.actionBuffer);
		this.actionViewIndex = 0; 
		

		/* Event Buffer Setup
        We want to record the x and y coordinates of the mouse cursor, relative to the current page.
        We want to associate this with a timestamp, we cheat by using only the lower 32 bits, which should not affect us
        since each telemetry aquisition should take no more than an hour.

        We use 32 bits for alignment purposes.
        */

		this.EVENT_RECORD_BASE_SIZE = 6;
		this.eventBuffer = new ArrayBuffer(this.EVENT_RECORD_COUNT_MAX * 2);
		this.eventBufferView16 = new Uint16Array(this.eventBuffer);
		this.eventViewIndex = 0; 



		this.MAX_OTHERDATA = 16384; 
	}

	exportData () {
		if (this.isActive) {
			this.deactivate(new Event("click"));
		}
		return [[this.BUFFER_TY_TELE, this.teleBufferView16.slice(0, this.teleViewIndex)], 
				[this.BUFFER_TY_ACTION, this.actionBufferView16.slice(0, this.actionViewIndex)],
				[this.BUFFER_TY_EVENT, this.eventBufferView16.slice(0, this.eventViewIndex)]];

	}
		

	/* Caputure mouse clicks 
		This will capture all mouse clicks to the document.
		Mouse clicks to challenge elements (I.e. challenge digits) will have the data set to 
		the challenge digit that was clicked (indexed from zero).
		All other clicks are classified as unknown.

		The buttons that the user clicks (I.e. submit, clear, new challenge) will
		show be captured here as 'unknown' but also log as an event with the same timestamp.

	*/
	mouseClickHandler (evt) {
		/*
		var timestamp = parseInt(evt.timeStamp);

		if (!timestamp) {
				timestamp = parseInt(Date.now());
		}
		*/
		var timestamp = Date.now();

		if (this.actionViewIndex < 6 ) {
			this.logEvent(evt, this.EVENT_TY_TIMESYNC, [evt.timeStamp & 0xFFFF, (evt.timeStamp & 0xFFFF0000) >>> 16]);
		}


		var xCoord = parseInt(evt.pageX);
		var yCoord = parseInt(evt.pageY);
		
		var originalIndex = this.actionViewIndex;	
		if (this.actionViewIndex + this.ACTION_RECORD_SIZE <= this.actionBufferView16.length) {
			
			

		
			this.actionBufferView16[this.actionViewIndex] = timestamp & 0xFFFF;
			++this.actionViewIndex;
			
			this.actionBufferView16[this.actionViewIndex] = (timestamp & 0xFFFF0000) >>> 16;
			++this.actionViewIndex;
			
			this.actionBufferView16[this.actionViewIndex] = xCoord;
			++this.actionViewIndex;
			
			this.actionBufferView16[this.actionViewIndex] = yCoord;
			++this.actionViewIndex;

			
			var domID = evt.explicitOriginalTarget.id;
			switch ((evt.explicitOriginalTarget.classList ? evt.explicitOriginalTarget.classList[0] : '')) 
			{
				case 'challengeElement':        
					var id = parseInt(domID);
					if (id == domID) {
						this.actionBufferView16[this.actionViewIndex] = this.ACTION_TY_DIGIT;
						++this.actionViewIndex;
						
						this.actionBufferView16[this.actionViewIndex] = id;
						++this.actionViewIndex;
					} else {
						this.actionBufferView16[this.actionViewIndex] = this.ACTION_TY_OTHER;
						++this.actionViewIndex;
						
						this.actionBufferView16[this.actionViewIndex] = this.ACTION_DT_EMPTY;
						++this.actionViewIndex;
					}
				break;
				
				default:
					this.actionBufferView16[this.actionViewIndex] = this.ACTION_TY_OTHER;
					++this.actionViewIndex;

					this.actionBufferView16[this.actionViewIndex] = this.ACTION_DT_EMPTY;
					++this.actionViewIndex;
			}
			console.log('<Click> ' + timestamp + ',' + this.actionBufferView16[this.actionViewIndex - 4] + ',' + this.actionBufferView16[this.actionViewIndex - 3] + ',' + this.actionBufferView16[this.actionViewIndex - 2] + ',' + this.actionBufferView16[this.actionViewIndex - 1]);
		} else {
			fatalError('ASSERT: Action buffer full.');
			this.actionViewIndex = originalIndex;
		}
		return true;
	}
	
	
	/* Caputure mouse movements */
	mousemoveHandler (evt) {
			/* 
				There is an ~ 5 ms delay (milage may vary based on load,machine,etc..) between when the event occurs 
				and when the handler executes. For this reason we use the timestamp registered with the event, this is
				the number of milliseconds elapsed from the beginning of the current document's lifetime till the event 
				was created [https://developer.mozilla.org/en-US/docs/Web/API/Event/timeStamp]
			*/

			/*
			var timestamp = parseInt(evt.timeStamp);
			if (!timestamp) {
				timestamp = parseInt(Date.now());
			}
			*/
			var timestamp = Date.now();
			var xCoord = parseInt(evt.pageX);
			var yCoord = parseInt(evt.pageY);
			

			var originalIndex = this.teleViewIndex;

			if (this.teleViewIndex + this.TELE_RECORD_SIZE <= this.teleBufferView16.length) {

				// Reuse the same view, but we are now stuffing a 32bit value into a 16bit view,
				// so let's pick an endianess: LSB!
				this.teleBufferView16[this.teleViewIndex] = timestamp & 0xFFFF;
				++this.teleViewIndex;
				
				this.teleBufferView16[this.teleViewIndex] = (timestamp & 0xFFFF0000) >>> 16;
				++this.teleViewIndex;
								
				this.teleBufferView16[this.teleViewIndex] = xCoord;
				++this.teleViewIndex;
									
				this.teleBufferView16[this.teleViewIndex] = yCoord;
				++this.teleViewIndex;
				
			} else {
				fatalError('ASSERT: Telemetry buffer full');
				this.teleViewIndex = originalIndex;
			}
			return false;
	}


	logEvent(evt, type, data) {
		/*
		var timestamp = parseInt(evt.timeStamp);
		if (!timestamp) {
				timestamp = parseInt(new Event('click').timeStamp);
		}
		*/
		if (type == this.EVENT_TY_TIMESYNC) {
			timestamp = evt.timestamp
		}
		var timestamp = Date.now()

			
		var xCoord = parseInt(evt.pageX);
		var yCoord = parseInt(evt.pageY);
			
		var originalIndex = this.eventViewIndex;	
		if (this.eventViewIndex + this.EVENT_RECORD_BASE_SIZE + data.length <= this.eventBufferView16.length) {
			
			this.eventBufferView16[this.eventViewIndex] = timestamp & 0xFFFF;
			++this.eventViewIndex;
			
			this.eventBufferView16[this.eventViewIndex] = (timestamp & 0xFFFF0000) >>> 16;
			++this.eventViewIndex;
			
			this.eventBufferView16[this.eventViewIndex] = xCoord;
			++this.eventViewIndex;
			
			this.eventBufferView16[this.eventViewIndex] = yCoord;
			++this.eventViewIndex;

			this.eventBufferView16[this.eventViewIndex] = type;
			++this.eventViewIndex;

			this.eventBufferView16[this.eventViewIndex] = data.length;
			++this.eventViewIndex;

			console.log('<Event> ' + timestamp + ',' + this.eventBufferView16[this.eventViewIndex - 4] + ',' + this.eventBufferView16[this.eventViewIndex - 3] + ',' + this.eventBufferView16[this.eventViewIndex - 2] + ',' + this.eventBufferView16[this.eventViewIndex - 1] + ',0');
			for (var i = 0; i < data.length; i++) {
				if ((data[i] > 65535 ) || (data[i] < 0)) {
					fatalError("ASSERT: Data bounds error logging event!");
					this.eventViewIndex = originalIndex;
					return false;
				}
				this.eventBufferView16[this.eventViewIndex] = data[i];
				++this.eventViewIndex;
			}


		} else {
			fatalError('ASSERT: Event buffer full');
			this.eventViewIndex = originalIndex;
		}
	}


	/* initialize event handlers */
	initHandlers() {
		// we need to call from the anonymous function back into this class so we can still be in the correct namespace, otherwise the context (this) will be the body objects
		var _that = this;
		this.docRoot.body.onclick = function (evt) {
			return _that.mouseClickHandler(evt);
		}
		
		this.docRoot.body.onmousemove = function (evt) {
			return _that.mousemoveHandler(evt);
		}	
	}
	
	/* uninitialize event handlers */
	destroyHandlers() {
		this.docRoot.body.onclick = null;
		this.docRoot.body.onmousemove = null;
	}

	/* Save to file local to the client machine. This is if we are running locally.
	  If this is running on a web server you most likely want to keep the files on the host -- in this case
	  you should be using the Controller.exportTelemetryData() function instead.
	  */
	saveToFile(uid, sid, ssid) {

		// detect if file saving is enabled
		try {
			if (saveAs == undefined) alert('File saving is not enabled');
		} catch (e) {
			console.error('ASSERT: File saving is not enabled');
			return false;	
		}

		if (!this.hasData()) {
			fatalError('ASSERT: All of the buffers are empty. File not saved.');
			return false;	
		}

		// we will create a fake session header
		// magic_num|ssid|section_len
		var buffer = new Uint16Array([this.version, 0, ssid, 1, 0]);

		//[magicnum | sid | len | register len (4bytes) | registers | buffer len (4 bytes)]
		// note: register is not present as specified by len=0
		buffer = buffer.concat([this.version, 0, sid, 0, 0, 3, 0]);

		// type, lenlo, lenhi, buffer...
		buffer = buffer.concat([this.BUFFER_TY_TELE, this.teleViewIndex & 0xFFFF, (this.teleViewIndex & 0xFFFF) >> 16]).concat(this.teleBufferView16.slice(0, this.teleViewIndex));
		buffer = buffer.concat([this.BUFFER_TY_ACTION, this.actionViewIndex & 0xFFFF, (this.actionViewIndex & 0xFFFF) >> 16]).concat(this.actionBufferView16.slice(0, this.actionViewIndex));
		buffer = buffer.concat([this.BUFFER_TY_EVENT, this.eventViewIndex & 0xFFFF, (this.eventViewIndex & 0xFFFF0000) >> 16]).concat(this.eventBufferView16.slice(0, this.eventViewIndex));

		var blob = new Blob([buffer], {type: 'application/binary'});
		var eventFilename = uid + '.' + 'dat';
		saveAs(blob, eventFilename);
		console.log('File saved as "' + eventFilename + '"');
		return true;
	}
	
	/* Returns true if at least one buffer has data (index != 0); false otherwise */
	hasData() {
		return (this.teleViewIndex > 0 || this.actionViewIndex > 0 || this.eventViewIndex > 0);
	}


	/* Activate a telemeter, 
	 * Returns true if the telemeter is active upon completion of the routine, false otherwise.
	 * NOTE: If the telemeter was already active, before this call, then the call will still return true.
	 * 		 It is the responsibility of the caller to handle this situation as they see fit.
	*/
	activate(evt) {
		if (this.isActive) {
				console.error('Attempted to activate an already active telemeter.');
				return true;
		}

		if (!this.firstRun && this.hasData()) {
				if (!confirm("Data exists in the buffers. Are you sure you want to append to the existing data? Otherwise, you must explicitely clear the data buffers.")) {
					return false;
				}
			}
		this.firstRun = false;
		this.isActive = true;
		this.logEvent(evt, this.EVENT_TY_ACTIVATION, []);
		this.initHandlers();
		
		console.log('Telemetry enabled');
		
		return true;
		
	}
	
	/* Returns true if the telemeter is/was not active, false otherwise */
	deactivate(evt) {
		if (!this.isActive) {
			console.error('Attempted to deactivate an already deactive telemeter.');
			return true;
		}
		this.destroyHandlers();
		this.logEvent(evt, this.EVENT_TY_DEACTIVATION, []);
		this.isActive = false;
		console.log('Telemetry disabled!');
	}

	resetData() {
		if (this.isActive) {
			console.error('Telemeter can only be reset when inactive.');
			return false;
		}

		for (var i = 0; i < this.teleBufferView16.length; i++)
			this.teleBufferView16[i] = 0;
		for (var i = 0; i < this.actionBufferView16.length; i++)
			this.actionBufferView16[i] = 0;
		for (var i = 0; i < this.eventBufferView16.length; i++)
			this.eventBufferView16[i] = 0;
		
		this.teleViewIndex = 0;
		this.actionViewIndex = 0;
		this.eventViewIndex = 0;
		this.firstRun = true;
		return true;
	}
	
	
	/* remove event listeners */
	cleanup() {
		if (this.isActive)
			this.deactivate({'timeStamp':Date.now(), 'pageX' : 0, 'pageY' : 0});
		this.resetData();
	}
	
}
