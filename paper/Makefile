# Makefile to generate .pdf files
# Mike Clark

FILES_IN=whitepaper.tex
FILES_OUT=$(patsubst %.tex, %.pdf, $(FILES_IN))

FILES_IN_GFX=$(wildcard *.dia)
FILES_OUT_GFX=$(patsubst %.dia, %.png, $(FILES_IN_GFX))


.PHONY: all
all: $(FILES_OUT_GFX) $(FILES_OUT) 

%.png: %.dia
	dia --export=$@ $<

%.pdf: %.tex
	pdflatex $<
	-bibtex $(basename $<)
	pdflatex $<
	pdflatex $<

.PHONY: clean
clean:
	@/bin/rm -f *~ *.bbl *.blg *.log *.aux *.toc *.lot *.lof *.out $(FILES_OUT) $(FILES_OUT_GFX)
