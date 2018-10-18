# Python Telemetry Data Viewer Version 1
# This program will take the custom-binary encoding of events output by the Telemetry
# class. This works on data files output using the Contoller stand-alone.
#
# See data format readme for more information.




import os
import sys
import fileinput

# FUTURE: paramaterize these in the cmd-line args
keySize = 3
valSize = 9
# FUTURE: this will decode under the key-shape-value realization, we should really pull the mappings directly from keyval.js
keyLookup = ['shape', 'fg colour', 'bg colour']
keyValLookup = [['five-star', 'diamond', 'hrect', 'vrect', 'circle', 'triangle-up', 'triangle-down', 'triangle-right', 'triangle-left', 'square'],
				['grey', 'green', 'blue', 'brown', 'red', 'yellow', 'orange', 'pink', 'cyan', 'white'],
				['grey', 'green', 'blue', 'brown', 'red', 'yellow', 'orange', 'pink', 'cyan', 'white']]

def toShort (byteLo, byteHi):
	return byteLo + (byteHi << 8)

def parseShort(byte):
	return toShort(ord(byte[0]), ord(byte[1])) 

def parseWord(byte):
	return toShort(ord(byte[0]), ord(byte[1])) +  (toShort(ord(byte[2]), ord(byte[3])) << 16)


def parseNewSecretData (f, itemCount):
	# read until we have consumed itemCount*2 bytes
	i=0
	buf = '<Data-secret>'
	while (i < itemCount):
		kv = toShort(f.read(2))
		i += 1
		val = kv % valSize
		key = math.floor(kv/ valSize)
		buf = buf + ' ' + keyValLookup[key][val] + ' ' +keyLookup[key] + ', '

	# FUTURE: sanity check (i == itemCount)
	print buf[:-1] + '.'# strip off last delimiter

# wrap io in try-catch
def parseNewChallengeDataDEPRECATED ():
	if keySize == 0:
		sys.stderr.write('Error: keysize cannot be zero')
		print 'ERROR '
		return 
	i=0
	buf = '<Data-challenge>'
	while (i + keySize < itemCount):
		if keySize > 1:
			if keySize > 2:
				#key = i % keySize
				for key in range(0, keySize - 2):
					val = toShort(f.read(2))
					i += 1
					buf = buf + ' ' + keyValLookup[key][val] + ' ' +keyLookup[key] + ' with '
			val = toShort(f.read(2))
			i += 1
			buf = buf + ' ' + keyValLookup[key][val] + ' ' +keyLookup[key] + ' and  '
		val = toShort(f.read(2))
		i += 1
		buf = buf + ' ' + keyValLookup[key][val] + ' ' +keyLookup[key] + '.'

		print buf

	

# Takes in an integer key set size and an array of values at least as large as the key size
def prettyPrintAttributes(keySz, vals):
	buf = ''
	i = 0
	if keySz > 1:
		if keySz > 2:
			for key in range(0, keySz - 2):
				val = vals[i]
				i += 1
				buf = buf + ' ' + keyValLookup[key][val] + ' ' + keyLookup[key] + ' with '
		val = vals[i]
		i += 1
		buf = buf + ' ' + keyValLookup[key][val] + ' ' +keyLookup[key] + ' and  '
	val = vals[i]
	i += 1
	buf = buf + ' ' + keyValLookup[key][val] + ' ' +keyLookup[key]
	return buf


# wrap io in try-catch



#[digit][key]


# A = i % 3
# B = floor(i / 3)

# i		A,B
# ===========
# 0	0	0,0
# 1	3	1,0
# 2	6	2,0

# 3	1	0,1
# 4	4	1,1
# 5	7	2,1

# 6	2	0,2
# 7	5	1,2
# 8	8	2,2
# \newline at grid_X

# // for 1 row
# parsing challenge
# for i in range(0, keySize * valSize * keySize):
# 	digit = (i % 3) + Math.floor(i / (keySize * gridX))
# 	key = Math.floor(i / 3)
# 	val = challenge[digit][key]
# 	print keyLookup[key] ... keyValLookup[digit][key] ... delimiter?
# 	if ((i +1) % gridX == 0)
# 		print \n

# 	if ((i + 1) % (gridX * keySize) == 0)
# 		print ======== \n


def parseNewChallengeData ():
	if keySize == 0:
		sys.stderr.write('Error: keysize cannot be zero')
		print 'ERROR '
		return 
	i=0
	buf = '<Data-challenge>'
	while (i + keySize < itemCount):
		for k in range(0, keySize):
			vals[k] = toShort(f.read(2))

		print	prettyPrintAttributes(keySize, vals)
		


def parseNewSubmitData ():
	# read until we have consumed itemCount*2 bytes
	i=0
	buf = '<Data-submit>'
	while (i < itemCount):
		 # FUTURE: wrap in try catch
		challengeDigit = toShort(f.read(2))
		i += 1	
		print prettyPrintAttributes(keySize, challengeLookup[challengeDigit])



def parseNewOtherData ():
	print 'parseNewOtherData(): Not implemented'


def parseEvent (f, itemCount):
	i = 0
	while (i < itemCount):
		try:
			timestamp = parseWord(f.read(4))
			xCoord = parseShort(f.read(2))
			yCoord = parseShort(f.read(2))
			ty = parseShort(f.read(2))
			dataLen = parseShort(f.read(2))
			print '<Event> {},{},{},{},{},{}'.format(timestamp , xCoord , yCoord, ty, dataLen, 0)# data is set to zero to confrom with the console.log happening in Telemeter.js
			for j in xrange(dataLen):
				data = parseShort(f.read(2))
				print '<Data> {},{:09d},{}'.format(timestamp, j ,data)
		except:
			print '<CORRUPT_EVENT> {},{},{},{},{}'.format(timestamp , xCoord , yCoord, dataLen, 0)
		i += 6 + (dataLen)
	return			
			
def parseAction (f, itemCount):
	i = 0
	while (i < itemCount):
		try:
			timestamp = parseWord(f.read(4))
			xCoord = parseShort(f.read(2))
			yCoord = parseShort(f.read(2))
			data1 = parseShort(f.read(2))
			data2 = parseShort(f.read(2))
			print '<Click> {},{},{},{},{}'.format(timestamp , xCoord , yCoord, data1, data2)
		except Exception as e:
			print '<CORRUPT_ACTION> {},{},{},{},{}'.format(timestamp , xCoord , yCoord, data1, data2)
		i += 6 # try and recover, if exception happened
	return

def parseTelemetry (f, itemCount):
	i = 0
	while (i < itemCount):
		try:
			timestamp = parseWord(f.read(4))
			xCoord = parseShort(f.read(2))
			yCoord = parseShort(f.read(2))
			print '<Movement> {},{},{}'.format(timestamp , xCoord , yCoord)
		except:
			print '<CORRUPT_MOVEMENT> {},{},{}'.format(timestamp , xCoord , yCoord)
		
		i += 4 # try and recover, if exception happened
	return



version = 1


filename = sys.stdin
if (len(sys.argv) > 1):
	filename = sys.argv[1]
with open(filename, 'rb') as f:
	try:
		#magicnum
		sectionVersion = parseShort(f.read(2))
		print 'Section Format Version:{}'.format(sectionVersion) # Read off the versioning info. Does nothing with it.
		f.read(2) # reserved

		# sid
		sid = parseShort(f.read(2))
		print 'Section ID:{}'.format(sid)
		
		#registers len
		registersLen = parseWord(f.read(4))
		print 'Register Count:{}'.format(registersLen)

		# registers
		for i in range(0, registersLen):
			print 'Register[{}]:{}'.format(i, parseShort(f.read(2)))

		#buffers len
		buffersLen = parseWord(f.read(4))
		print 'Buffers Count:{}'.format(buffersLen)

		#buffers
		for j in range(0, buffersLen):
			print 'Buffer[{}] File Offset:{:02x}'.format(j, f.tell())

			#buffer type
			bufferType = parseShort(f.read(2))
			print 'Buffer Type[{}]:{}'.format(j, bufferType)
			#buffer len
			bufferLen = parseWord(f.read(4))
			print 'Buffer[{}] Length:{}'.format(j, bufferLen)
			
			# FUTURE: eliminate hardcoded types with common const
			if (bufferType == 1):
				#TELE
				parseTelemetry(f, bufferLen)
			elif (bufferType == 2):
				#ACTION
				parseAction(f, bufferLen)
			elif (bufferType == 3):
				#EVENT
				parseEvent(f, bufferLen)
			else:
				raise ValueError('Invalid buffer type.')
		cursor = f.tell()
		f.seek(0, os.SEEK_END)
		endCursor = f.tell()
		if cursor != endCursor:
			print '{} bytes left unprocessed in the input file'.format(endCursor - cursor)
	except:
		sys.stderr.write('Error reading files')