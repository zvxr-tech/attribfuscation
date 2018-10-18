#!/bin/python
# scale svg points to a fixed size and translate by an offset in x & y
import sys
SHAPENAME="pentagon"
DST_SIZE = 0.65
DST_XOFF = 0.20
DST_YOFF = 0.15

# MODIFY ABOVE TO DO COOL STUFF!

PREFIX="<polygon id=\"" + SHAPENAME + "\" points=\""
SUFFIX="\" />"


x = []
y = []
try:
	[tx,ty] = sys.stdin.readline().split(" ")
	while 1:
		x.append(float(tx))
		y.append(float(ty[:-1]))

		[tx,ty] = sys.stdin.readline().split(" ")
except:
	1 == 1

# find min/max
xmin = min(x)
xmax = max(x)
ymin = min(y)
ymax = max(y)

# calculate new coords offset from zero
offx = [ xx - xmin for xx in x ]
offy = [ yy - ymin for yy in y ]

# calculate which dimensions scale to use
maxdim = max(xmax - xmin, ymax - ymin)
scale = DST_SIZE / maxdim

# apply scaling
scalex = [ xx * scale + DST_XOFF for xx in x ]
scaley = [ yy * scale + DST_YOFF for yy in y ]

sys.stdout.write(PREFIX)
for i in range(1, len(scalex)):
	sys.stdout.write("{},{} ".format(scalex[i], scaley[i]))
sys.stdout.write(SUFFIX + "\n")