# Python Telemetry Data Viewer Version 2
# This program will take the custom-binary encoding of events output by the Telemetry
# class. This works on data files output ussing the Session class.
#
# See data format readme for more information.

################################################################################
import os
import sys
import fileinput
import math
import array

version = 1 # This will be checked against version numbers embedded in the input data being processed
################################################################################
# PARAMETERS - will be initialized when EVENT_TY_CTLRESET event is procesesed
keySize = None
valSize = None
challengeGridX = None


################################################################################
challengeLookup = []


# Numeric KeyVals ('grid-numeric') - if we use key>1 or valsize>100, change the hardcoded values below
# Shape Colour Colour KeyVals ('grid').
keyLookupMaster = {'grid-numeric': ['Numeral'],
		  'grid': ['shape', 'fg colour', 'bg colour']}

tmpKV = [[str(i) for i in range(100)]] # identity list (1,2,3,4,...)
keyValLookupMaster = {'grid-numeric': tmpKV,
             		  'grid' : [['       ', 'diamond', 'Hrect  ', 'Vrect  ', 'circle ', 'tri-up ', 'tri-dwn', 'tri-Rt ', 'tri-Lt ', 'square '],
					  			['       ', 'red    ', 'green  ', 'blue   ', 'yellow ', 'brown  ', 'magenta', 'cyan   ', 'white  ', 'orange '],
					   			['       ', 'red    ', 'green  ', 'blue   ', 'yellow ', 'brown  ', 'magenta', 'cyan   ', 'white  ', 'orange ']]}

# The actual key/keyValLookup table used will be resolved when a EVENT_TY_CTLRESET is processed.
# The uiType will be used as an index into the Master tables above to extract the relevant.
# Lookups for the challenge/responses presented/entered events being processed
keyLookup = None
keyValLookup = None
maxValLen = None

################################################################################
#CONSTANTS imported from other modules
ACTION_TY_ERROR = 0
ACTION_TY_DIGIT = 1
ACTION_TY_OTHER = 2


# Session Registers
REG_TY_TOT = 0
REG_TY_ACK = 1
REG_TY_ACK_RUN = 2
REG_TY_NAK = 3
REG_TY_NAK_RUN = 4
REG_TY_COUNT = 5


BUFFER_TY_TELE = 1
BUFFER_TY_ACTION = 2
BUFFER_TY_EVENT = 3


ACTION_TY_ERROR = 0
ACTION_TY_DIGIT = 1
ACTION_TY_OTHER = 2

EVENT_TY_ERROR = 0
EVENT_TY_NEWSECRET = 11
EVENT_TY_NEWCHALLENGE = 12
EVENT_TY_SUBMIT = 13
EVENT_TY_RESPONSECLEAR = 14

EVENT_TY_ACTIVATION = 42
EVENT_TY_DEACTIVATION = 43
EVENT_TY_ACTIVATIONCHANGE = 44
EVENT_TY_OTHERDATA = 45
EVENT_TY_TIMESYNC = 46
EVENT_TY_CTLRESET = 47

EVENT_DT_EMPTY = 0

# FUTURE: incorporate into common.js, instead of having two defintions that must be kept in-sync
EVENT_DT_INVALID = 0
EVENT_DT_VALID = 1


DIGIT_V_DELIMITER = u'|'
DIGIT_H_DELIMITER = u'-'



################################################################################				
def toShort (byteLo, byteHi):
	return byteLo + (byteHi << 8)

def parseShort(byte):
	return toShort(ord(byte[0]), ord(byte[1]))

def parseWord(byte):
	return toShort(ord(byte[0]), ord(byte[1])) +  (toShort(ord(byte[2]), ord(byte[3])) << 16)

################################################################################
# Takes in an integer key set size and an array of values at least as large as 
# the key size.
# Used to print a string describing the combined attributes of one object.
# Attribute value is capitalized.
def ppAttributes(keySz, vals):
	buf = u''
	i = 0
	if keySz > 1:
		if keySz > 2:
			for key in range(0, keySz - 2):
				val = vals[i]
				i += 1
				buf = buf + keyValLookup[key][val].upper()  + u' ' + keyLookup[key] + u' with '
		val = vals[i]
		buf = buf + keyValLookup[i][val].upper() + u' ' + keyLookup[i] + u' and '
		i += 1
	val = vals[i]
	buf = buf +  keyValLookup[i][val].upper() + u' ' + keyLookup[i]
	i += 1
	return buf

def calculateMaxValLen(kSz, vSz):
	maxLen = 0
	for k in range(0, kSz): #len(keyValLookup)):
		for v in range(0, vSz): #len(keyValLookup[k])):
			if len(keyValLookup[k][v]) > maxLen:
			 	maxLen = len(keyValLookup[k][v])
	return int(maxLen)

# Input: 
#		l - list to divide up
#		k - number of items per chunk
# Output:
#		An ordered list of of k sublists of l
# Based on, https://stackoverflow.com/questions/24483182/python-split-list-into-n-chunks
def chunkChallenge(l,k):
	if len(l) % k:
		raise ValueError('List length must be evenly divisible by the chunk size.')
	n = len(l) / k
	ret = []
	num = float(len(l))/n
	ret = [l [i:i + int(num)] for i in range(0, (n-1)*int(num), int(num))]
	ret.append(l[(n-1)*int(num):])

	return ret

def ppNewSecret(data, timestamp):
	# First convert the secret into the same format as newChallenge data
	tmp = [0] * (len(data) * keySize)

	for i in range(0, len(data)):
		kv = data[i]
		val = int(kv % valSize)
		key = int(math.floor(kv/ valSize))
		tmp[i * keySize + key] = val + 1 # add one because the secret does not include the sentinal values
	
	buf = ppNewChallenge(tmp, timestamp, len(data))
	return buf

def ppNewChallenge(data, timestamp, gridX):
	
	#assert len(data) % keyCount == 0
	digitSize = int(len(data) / keySize)

	rowSize = int(math.ceil(digitSize/ float(gridX)))
	lastRowCol = gridX - 1  if digitSize % gridX == 0 else (digitSize % gridX) - 1
	totalPaddingLen = (maxValLen * gridX) + (len(DIGIT_V_DELIMITER) * (gridX + 1))

	buf = u'<Human>,{:010d},'.format(timestamp) +  u' ' * len(DIGIT_V_DELIMITER) +  DIGIT_H_DELIMITER * (totalPaddingLen - 2) + u'\n'
	for row in range(rowSize):
		for key in range(keySize):
			buf = buf + u'<Human>,{:010d},'.format(timestamp) +  DIGIT_V_DELIMITER
			for col in range(gridX):
				digit = row * gridX + col
				val = data[digit * keySize + key]
				#buf =  buf + str((row * gridX + col)) + ',' + str(key) + ','
				buf = buf + keyValLookup[key][val] + DIGIT_V_DELIMITER
				if row == rowSize - 1 and col == lastRowCol:
					break
			buf = buf +  u'\n'
		if row + 1 == rowSize:
			buf = buf + u'<Human>,{:010d},'.format(timestamp) + u' ' * len(DIGIT_V_DELIMITER) +  DIGIT_H_DELIMITER * (totalPaddingLen - 2) 
		else:
			buf = buf + u'<Human>,{:010d},'.format(timestamp) +  DIGIT_V_DELIMITER + DIGIT_H_DELIMITER * (totalPaddingLen - 2) + DIGIT_V_DELIMITER + u'\n'
	return buf

def ppSubmit (data, timestamp):
	tmp = []
	for i in range(0, len(data)):
		# lookup the tuple (v1,v2,...) for a digit
		digit = data[i]
		kv = challengeLookup[digit]
		tmp = tmp + kv		
	return  ppNewChallenge(tmp, timestamp, len(data))

def ppOtherData (data, timestamp):
	linePrependStr = u'<Human>,{:010d},'.format(timestamp)
	bufOut = u''
	try:
		#https://stackoverflow.com/questions/38727390/how-can-i-decode-a-utf-8-byte-array-to-a-string-in-python2
		buf = data
		buf = array.array('B', data).tostring().decode('utf-8')
		buf = buf[:-1] # strip off last newline
		bufOut = buf.replace('\n', '\n' + linePrependStr)
	except Exception as e:
		bufOut =  u'UTF-8 Decoding Error!'
	kkk = linePrependStr + bufOut
	return kkk
	
def ppTimeSync (data,timestamp):
	syncTime = data[0] + (data[1] << 16)
	return u'<Human>,{:010d},{}'.format(timestamp, syncTime)

def ppReset (data, timestamp):
	global 	keySize, valSize, challengeGridX, maxValLen, keyValLookup, keyLookup

	linePrependStr = u'<Human>,{:010d},'.format(timestamp)
	startCursor = 0

	keySize = data[startCursor]
	startCursor += 1
	valSize = data[startCursor]
	startCursor += 1
	
	endDataCursor = data.index(10) # match to the first newline (ascii = 10)
	tmpArr = data[startCursor:endDataCursor]
	uiType = array.array('b', tmpArr).tostring().decode('utf-8')
	startCursor = endDataCursor + 1 # one [ast the newline]

	endDataCursor = data[startCursor:].index(10) + startCursor
	tmpArr =  data[startCursor:endDataCursor]
	challengeMode = array.array('b', tmpArr).tostring().decode('utf-8')
	startCursor = endDataCursor + 1 # one past the newline

	challengeGridX = data[startCursor]
	startCursor += 1

	buf = u'{0}keySize = {1}\n{0}valSize = {2}\n{0}uiType = {3}\n{0}challengeMode = {4}\n{0}challengeChallengeDimX = {5}\n{0}challengeChallengeDimY = {6}\n{0}challengeChallengeResX = {7}\n{0}challengeChallengeResY = {8}\n{0}challengeResponseDimX = {9}\n{0}challengeResponseDimY = {10}\n{0}challengeResponseResX = {11}\n{0}challengeResponseResY = {12}\n{0}secretChallengeDimX = {13}\n{0}secretChallengeDimY = {14}\n{0}secretChallengeResX = {15}\n{0}secretChallengeResY = {16}\n{0}secretResponseDimX = {17}\n{0}secretResponseDimY = {18}\n{0}secretResponseResX = {19}\n{0}secretResponseResY = {20}\n{0}secretSizeMin = {21}\n{0}secretSizeMax = {22}'.format(linePrependStr, keySize, valSize, uiType, challengeMode, challengeGridX, *data[startCursor:])
	try:
		tmp = keyLookupMaster[uiType]
		tmp = keyValLookupMaster[uiType]
		keyLookup = keyLookupMaster[uiType]
		keyValLookup = keyValLookupMaster[uiType]
		maxValLen = calculateMaxValLen(keySize, valSize)
	except:
		buf += u'\n' + linePrependStr + u'uiType not found in keyVal lookup tables.'

	return buf

def ppEventData(ty, timestamp, data):
	global challengeLookup

	if ty == EVENT_TY_ERROR:
		print u'<Human>,{:010d},Error event.'.format(timestamp)
	elif ty == EVENT_TY_NEWSECRET:
		print u'<Human>,{:010d},{} secret generated:\n{}'.format(timestamp, u'Valid' if data[0] == EVENT_DT_VALID else u'Invalid', ppNewSecret(data[1:], timestamp))
	elif ty == EVENT_TY_NEWCHALLENGE:
		print u'<Human>,{:010d},Valid challenge generated:\n{}'.format(timestamp, ppNewChallenge(data, timestamp, challengeGridX))	
		challengeLookup = chunkChallenge(data,keySize)
	elif ty == EVENT_TY_SUBMIT:
		print u'<Human>,{:010d},{} response submitted:\n{}'.format(timestamp, u'Correct' if data[0] == EVENT_DT_VALID else u'Incorrect',ppSubmit(data[1:], timestamp))
	elif ty == EVENT_TY_RESPONSECLEAR:
		print u'<Human>,{:010d},Response cleared.'.format(timestamp) 
	elif ty == EVENT_TY_ACTIVATION:
		print u'<Human>,{:010d},Telemeter activated.'.format(timestamp)
	elif ty == EVENT_TY_DEACTIVATION:
		print u'<Human>,{:010d},Telemeter deactivated.'.format(timestamp)
	elif ty == EVENT_TY_ACTIVATIONCHANGE:
		print u'<Human>,{:010d},Telemeter activation state change.'.format(timestamp)
	elif ty == EVENT_TY_OTHERDATA:
		bbb = ppOtherData(data, timestamp)
		try:
			print u'<Human>,{:010d},Form data:\n{}'.format(timestamp, bbb)
		except Exception as e:
			print e
		#print u'<Human>,{:010d},Form data:\n{}'.format(timestamp, ppOtherData(data, timestamp))
	elif ty == EVENT_TY_TIMESYNC:
		print u'<Human>,{:010d},Time Sync :\n{}'.format(timestamp, ppTimeSync(data, timestamp))
	elif ty == EVENT_TY_CTLRESET:
		# This does no occur until after the new  challenge and new secret event, so we do not know the proper keysize
		print u'<Human>,{:010d},System reset with controller parameters:\n{}'.format(timestamp, ppReset(data, timestamp))
	else:
		raise ValueError('Unknonw event type.')

def parseEvent (f, itemCount):
	i = 0
	while (i < itemCount):
		try:
			timestamp = parseWord(f.read(4))
			xCoord = parseShort(f.read(2))
			yCoord = parseShort(f.read(2))
			ty = parseShort(f.read(2))
			dataLen = parseShort(f.read(2))
			print u'<Event>,{},{},{},{},{},{}'.format(timestamp , xCoord , yCoord, ty, dataLen, 0)# data is set to zero to confrom with the console.log happening in Telemeter.js
			dataList = []
			for j in xrange(dataLen):
				data = parseShort(f.read(2))
				dataList.append(data)
				print u'<Data>,{:010d},{:010d},{}'.format(timestamp, j ,data)

			ppEventData(ty, timestamp, dataList)
		except Exception as e:
			print u'<CORRUPT_EVENT>,{:010d},{},{},{},{},{}'.format(timestamp , xCoord , yCoord, ty, dataLen, 0)

		i += 6 + (dataLen)
	return			(data)
			
def parseAction (f, itemCount):
	i = 0
	while (i < itemCount):
		try:
			timestamp = parseWord(f.read(4))
			xCoord = parseShort(f.read(2))
			yCoord = parseShort(f.read(2))
			data1 = parseShort(f.read(2))
			data2 = parseShort(f.read(2))
			print u'<Click>,{:010d},{},{},{},{}'.format(timestamp , xCoord , yCoord, data1, data2)
			if 	data1 == ACTION_TY_ERROR:
				print u'<Human>,{:010d},Error action with data={}.'.format(timestamp, data2)
			elif data1 == ACTION_TY_DIGIT:
				print u'<Human>,{:010d},Challenge digit {} was selected.'.format(timestamp, data2 + 1)
			elif data1 == ACTION_TY_OTHER:
				print u'<Human>,{:010d},Click at relative page location (x={}, y={}).'.format(timestamp, xCoord, yCoord)
			else:
				print u'<Human>,{:010d},Unknown action.'.format(timestamp)
		except Exception as e:
			print u'<CORRUPT_ACTION>,{:010d},{},{},{},{}'.format(timestamp , xCoord , yCoord, data1, data2)
			print u'<Human>Corrupted action.'

		i += 6 # try and recover, if exception happened
	return

def parseTelemetry (f, itemCount):
	i = 0
	while (i < itemCount):
		try:
			timestamp = parseWord(f.read(4))
			xCoord = parseShort(f.read(2))
			yCoord = parseShort(f.read(2))
			print u'<Movement>,{:010d},{},{}'.format(timestamp , xCoord , yCoord)
			print u'<Human>,{:010d},Mouse moved to relative page location (x={}, y={}).'.format(timestamp, xCoord, yCoord)
		except:
			print u'<CORRUPT_MOVEMENT>,{:010d},{},{}'.format(timestamp , xCoord , yCoord)
		
		i += 4 # try and recover, if exception happened
	return


if (len(sys.argv) > 1):
	timestamp = 0
	#gCounter = 0
	filename = sys.argv[1]
	with open(filename, 'rb') as f:
		endCursor = f.seek(0, os.SEEK_END) 
		endCursor = f.tell()
		cursor = f.seek(0, os.SEEK_SET) 
		cursor = f.tell()

		try:
			#magicnum
			sessionVersion = parseShort(f.read(2))
			print u'<Meta>,{:010d},File Format Version:{}'.format(timestamp, sessionVersion) # Read off the versioning info. Does nothing with it.
			f.read(2) # reserved
			if (sessionVersion != version):
				raise ValueError('Version mismatch.')

			# ssid
			ssid = parseShort(f.read(2))
			print u'<Meta>,{:010d},Session ID:{}'.format(timestamp, ssid)
			
			#sections len
			sectionsLen = parseWord(f.read(4))
			print u'<Meta>,{:010d},Section Count:{}'.format(timestamp, sectionsLen)

			#sections
			for i in range(0, sectionsLen):
				#magicnum
				sectionVersion = parseShort(f.read(2))
				print u'<Meta>,{:010d},Section Format Version:{}'.format(timestamp, sectionVersion) # Read off the versioning info. Does nothing with it.
				f.read(2) # reserved

				# sid
				sid = parseShort(f.read(2))
				print u'<Meta>,{:010d},Section ID:{}'.format(timestamp, sid)
		
				#registers len
				registersLen = parseWord(f.read(4))
				print u'<Meta>,{:010d},Register Count:{}'.format(timestamp, registersLen)
				
				# registers
				for i in range(0, registersLen):
					print u'<Meta>,{:010d},Register({}):{}'.format(timestamp, i, parseShort(f.read(2)))

				#buffers len
				buffersLen = parseWord(f.read(4))
				print u'<Meta>,{:010d},Buffers Count:{}'.format(timestamp, buffersLen)

				#buffers
				for j in range(0, buffersLen):
					print u'<Meta>,{:010d},Buffer({}) File Offset:{:02x}'.format(timestamp, j, f.tell())

					#buffer type
					bufferType = parseShort(f.read(2))
					print u'<Meta>,{:010d},Buffer Type({}):{}'.format(timestamp, j, bufferType)
					#buffer len
					bufferLen = parseWord(f.read(4))
					print u'<Meta>,{:010d},Buffer([){}) Length:{}'.format(timestamp, j, bufferLen)

					if (bufferType == BUFFER_TY_TELE):
						#TELE
						parseTelemetry(f, bufferLen)
					elif (bufferType == BUFFER_TY_ACTION):
						#ACTION
						parseAction(f, bufferLen)
					elif (bufferType == BUFFER_TY_EVENT):
						#EVENT
						parseEvent(f, bufferLen)
					else:
						raise ValueError('Invalid buffer type.')
			cursor = f.tell();
			
			
		except Exception as e:
				print u'<Meta>,{:010d},Error reading file(s).'.format(timestamp)
		
		if cursor != endCursor:
			print u'<Meta>,{:010d},{} bytes left unprocessed in the input file'.format(timestamp, endCursor - cursor)
else:
	print u'Usage: {} <DATA_FILENAME>'.format(sys.argv[0])