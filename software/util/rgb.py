# Scale a newline delimited list of hex rgb values
# Example
# Ex input:  #122f13
# Ex output: keyValLookup[][1] = rgb(18,47,19)

import sys


if len(sys.argv)< 2:
	denominator=1.0
else:
	denominator=float(sys.argv[1])
i = 0;
while i >= 0:
	try:
		sys.stdin.read(1) # read hash sign and discard
		rv = sys.stdin.read(2) # read R
		gv = sys.stdin.read(2) # read G
		bv = sys.stdin.read(2) # read B
		print "keyValLookup[][" + str(i) + "] = 'rgb(" + str(int(int(rv,16)*denominator)) + "," + str(int(int(gv,16)*denominator)) + "," + str(int(int(bv,16)*denominator)) + ")';"
		i += 1
		sys.stdin.read(1) # read newline  and discard
	except:
		i=-1	