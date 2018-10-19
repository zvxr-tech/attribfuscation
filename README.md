# Attribfuscation

# Abstract

In a *traditional* password system such as the numeric pinpad on most Automated Teller Machines (ATM), the user is presented with a challenge (i.e. the numerals 1 through 9 presented over a 3-by-3 grid), and the user must then enter the corresponding response (which is their secret/password). The correct secret is a successful response to the challenge presented, and a failure otherwise. However, this challenge-response password system suffers from attacks where an adversary can deduce the secret either directly (direct observation) or indirectly (physical indicators such as smudges or worn buttons). Once the adversary knows the secret, they can provide a valid response to the system. In other words, an adversary will know the password with absolute certainty after viewing the user enter their password once.

In this document, we propose a new challenge-response authentication (CRA) protocol and an implementation that uses the new protocol. The system allows for the adversary to have complete and full observations of a user's challenges and responses, yet there will still remain a calculable amount of uncertainty as to what the user's secret is. This property is leveraged to provide security against shoulder-surfing and smudge-like attacks.

# Whitepaper

The [paper/](paper/) directory contains files related to a writeup with respect to the proposed system and protocol.
The [README](paper/README.md) in the root of that directory contains a writeup for proposed system and protocol written for a non-technical audience.
The remainder of the directory contains the beginnings of a formal whitepaper written in LaTex that is incomplete.

# Software
The [software/](software) directory contains all of the source code libraries and documentation to implement our proposed system, as well as an extensible framework for rapidly prototyping new CRA systems. It also contains an extensible framework for conducting autonomous usability studies on arbitrary CRA systems.
More details are available in the accompanying [README](software/README.md).

# Demonstration
A demonstration of the study framework, as well as three standalone implementations can be accessed [here](software/www/index.html).

# Media
The [media/](media/) directory contains media used in documentation. (This is independent of the media used within the software.)

# Theory
The [theory/](theory/) directory contains MATLAB code that attempts to quantify the entropy of our system as a function of the number of challenge-response events an adversary has observed as well as the system parameters of the CRA.
