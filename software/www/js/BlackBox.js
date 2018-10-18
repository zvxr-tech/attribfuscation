/*
Attribfuscator - BlackBox
Mike Clark - 2017
ATTRIBUTE KEY-SPACE, VAL-SPACE
This prototype specifies a challenge-response blackbox which is parameterized over an enumeration of attribute keys (types) and values.
For example, we could have a key set of size 2 and value set of size 3.

	key = {0,1}
	val = {0,1,2}


SECRET-SPACE
The powerset of the keys and values forms the secret-space.
Using our example, this would yield the following secret-space of size 6 (val*key):

	{(0,0), (0,1), (0,2), (1,0), (1,1), (1,2)}


SECRET
A secret is an ordered set of key-value attribute pairs.

	((1,2),(0,0))

, this secret's first digit is the 2 value of key 1. It's second digit is the 0 value of key 0.
The secret received by the blackbox is in this format.


CHALLENGE-SPACE
The challenge-space is every unique, ordered set of key-value pair groupings.
Each challenge-space digit contains each attribute key, whose value is one not set as the value for the same key in a different challenge-space digit.

The challenge-space is constrained to the size of the value size to guarantee
that every key-value pair will be present in the challenge space.
Using our example, one possible challenge instance from the challenge-space set for |key|=3, |val|=3 would be:

	({(0,2),(1,0),(2,1)} , {(0,1),(1,1),(2,0)} , {(0,0),(1,2),(2,2)})

This expresses a challenge where the first challenge digit contains the attribute values 2, 0, and 1 for the attribute keys 0, 1, and 2, respectively.
The second challenge digit contains the attribute values 1, 1, and 0 for the attribute keys 0, 1, and 2, respectively.
The third, and last, challenge digit contains the attribute values 0, 2, and 2 for the attribute keys 0, 1, and 2, respectively.

Another challenge instance may be a re-ordering of the challenge digits,

	({(0,1),(1,1),(2,0)} , {(0,2),(1,0),(2,1)} , {(0,0),(1,2),(2,2)})

, where, in this case, the first and second digit of the first example challenge have been transposed.

The sub-groups of the challenge instance may also be of different compositions, such as

	({(0,2),(1,0),(2,1)} , {(0,1),(1,1),(2,0)} , {(0,0),(1,2),(2,2)}), and
	({(0,2),(1,0),(2,2)} , {(0,1),(1,1),(2,0)} , {(0,0),(1,2),(2,1)}).

However, the ordering of the attribute key-value pairs in the challenge digit grouping *does not* matter, so the
following two challenges are not unique,

	({(0,2),(1,0),(2,1)} , {(0,1),(1,1),(2,0)} , {(0,0),(1,2),(2,2)}), and
	({(1,0),(0,2),(2,1)} , {(0,1),(2,0),(1,1)} , {(0,0),(1,2),(2,2)}).

, where the only difference is the ordering of the key-value pairs (1,0) and (0,2) in the first challenge digit.


RESPONSE
A response to a challenge can be encoded as the ordered set of linear address (zero-indexed) of the challenge digit posistion.
For example,

	(0,1,1)

, would encode the response "first challenge digit, second challenge digit, second challenge digit".

If the challenge for this response was,

	({(0,2),(1,0),(2,1)} , {(0,1),(1,1),(2,0)} , {(0,0),(1,2),(2,2)})

, the response would express the following attribute groupings:

	({(0,2),(1,0),(2,1)},
	{(0,1),(1,1),(2,0)},
	{(0,1),(1,1),(2,0)}).


SOLUTION
The correct response (solution) to a given challenge is a function of the secret and challenge.

	response validity = f(challenge, secret, response) =?= {correct | incorrect}

If we know the secret and challenge apriora, we can compute a solution and encode it in a format similar to the response discussed earlier.

	solution = g(challenge, secret)

We can then simplify the response validity function,

	response validity = f(solution, response) = IF(response == solution) THEN correct ELSE incorrect

For example,
	Suppose we have the following system paramaters:

		keySize = 2;
		valSize = 3;

	, and the following challenge and secret derived from their respective spaces,

		challenge = ({(0,2),(1,0),(2,1)} , {(0,1),(1,1),(2,0)} , {(0,0),(1,2),(2,2)})
		secret = ((1,2),(0,0))

	, we can then compute the solution response,

		solution = (2,2).


BLACKBOX
The BlackBox prototype realizes the above challenge response system.
It is instantiated with the attribute key-space and value-space sizes,
and provides the ability to generate random challenges, set the secret, and
validate challenge responses against the secret.

After creation, a challenge must be generated and secret set before the BlackBox
can validate a challenge response.




There is no facility to change the attribute key or value sizes. If this is desired,
simply instantiate a new BlackBox with those parameters.

Parameters:
	keySize - the number of attribute types.
	valSize - the number of values that each attribute type can take on.
*/
function BlackBox(keySize, valSize, challengeMode) {
    var that = this;
    /*******************************************************************************
	PRIVILEGED
	*******************************************************************************/
	/*
	The BlackBox provides the following Public Services:
		accept generic request
			- this is an interface that accepts secret set requests, and response validation checks
		
		validate response
			- test the correctness of a response, using the current challenge and secret

		set secret
			- set the secret (NOTE: there is no way to publicly retrieve the secret after this)

		getParams
			- return an array of length two, containing the key size in the first index and value size in the second.

		get challenge
			- get the current challenge

		next challenge
			- generate and get a fresh, random challenge.

		cleanup
			- RESERVED (unused)
	*/
    this.cleanup = function () {return true;}

    this.getParams = function () {
    	return [keySize, valSize];
    }

    this.nextChallenge = function () {
    	challenge = generateChallenge();
    	return this.getChallenge();
	}

    this.getChallenge = function () {
    	return challenge;
    }

    this.getSparseSecretSpace = function () {
    	return generateSparseSecretSpace();
    }

    this.acceptGeneric = function(responseParam, responseType) {
    	switch (responseType) {
    		case 'challenge':
    			return validateResponse(responseParam);
    		break;
    		case 'secret':
    			return setSecret(responseParam);
    	}
    	return false;
    }

    /*******************************************************************************
	PRIVATE
	*******************************************************************************/
    /* Test the validity of a response by solving the challenge with the secret
    	and comparing it to the response.

    	Returns true on valid, false on invalid.
    */
    function validateResponse(responseParam) {
    	var solution = solveChallenge();
        if (solution != null && responseParam.length == solution.length) {
	        for (let i = 0; i < responseParam.length; i++) {
	            if (responseParam[i] != solution[i]) {
	                return false;
	            }
	        }
	    } else {
	        return false;
	    }

    	return true;
    }

    function solveChallenge() {
	    // return an an empty solution if either challenge or solution are not set
	    if (challenge == null || secret == null)
	        return null;

	    var solution = new Array(secret.length);

	    for (let i = 0; i < secret.length; i++) {
	        let key = secret[i][0];
	        let val = secret[i][1];
	        for (let j = 0; j < challenge.length; j++) {
	            if (challenge[j][key] == val) {
	                solution[i] = j;
	                break;
	            }
	            // predicate==true iff last iteration
	            if (j == challenge.length - 1) {
	                fatalError("ASSERT: failed to solve challenge!");
	                return null;
	            }
	        }
	    }
	    if (typeof solution[0] == 'undefined') {
	        fatalError("ASSERT: solution not found)");
	        return null;
	    }
	    return solution;
    }

    /*
    secretParam is an array of the secret digits, indexed
    by their natrual ordering. Each array element value is the linear address into the secretSpace.
    Internally, secret is kept as an array of secret digits, each having an array with indicies 0:key, 1:val
    */
    function setSecret(secretParam) {
    	// the secretParam will be a linear address into the secret space
    	// we need to convert this to the key-value pair
		var max = secretParam.length;
		secret = new Array();
		for (let i = 0; i < max; i++) {
			secret.push([Math.floor(secretParam[i] / valSize), Math.floor(secretParam[i] % valSize) + 1]);
		}
		return true;
    }

	/*
	Return an array representing a random challenge configuration.

	The first dimension is indexed by the challenge element's position relative to the linear-addressed grid position.
	The second dimension is indexed by the attribute key of that particular challenge element.
	The value stored is the attribute value for that particular challenge element attribute key.
	*/
	function generateChallenge() {
		// generate an array of keys, each containing an array of attribute values
    	// this is used as a ppol to remove key-values from when they are chosen.
    	var attributes = generateAttributeSpace();

	    // create an empty challenge matrix
    	challenge = new Array(valSize);
	    for (let i = 0; i < challenge.length; i++) {
	        challenge[i] = new Array(keySize);
	    }

	    // populate the challenge matrix with random key-value groupings per challenge grid element.
	    // NOTE: if you wanted to make the challenge space larger than the valSize, you would do it by changing the
	    // predicate on the for loop below
	    for (let element = 0; element < valSize; element++) {
	        for (let key = 0; key < keySize; key++) {
	            
	        	if (challengeMode == 'challengeModeRandom') {
	            	// choose random value from unchosen key values remaining, add 1 to reserve space (index=0) for the sentinal value of each key
	            	challenge[element][key] = attributes[key].splice(Math.floor(Math.random() * attributes[key].length), 1)[0] + 1;
	            } else if (challengeMode == 'challengeModeIdentity') {
	            	challenge[element][key] = element + 1;
	            } else {
	            	fatalError('ASSERT: Invalid challenge mode "' + challengeMode + '"');
	            }
	        }
	    }
	    return challenge;
	}

	/* Creates a helper data struct from the attribute keys and values that is used to generate a random challenge.
	This does not include the sentinal value, so everything is shifted down by 1.*/
    function generateAttributeSpace() {
		var attributes = new Array(keySize);
	    for (let i = 0; i < keySize; i++) {
	        attributes[i] = new Array(valSize);
	        for (let j = 0; j < valSize; j++) {
	            attributes[i][j] = j;
	        }
	    }
	    return attributes;
    }

    /*
    Generate every element with a single key set to each possible value, while the others
    are sent to a sentinel value (0) so that each element represents a particular key-value pair
    in isolation.
    Because the sentinal the keyValLookup should have the sentinel attribute values for each key (I.e. size of the lookup table should be valSize + 1).
    Ex. keySize=2, valSize=3
    	{{(0,0),(1,3)}, {(0,1),(1,3)}, {(0,2),(1,3)},
    	 {(0,3),(1,0)}, {(0,3),(1,1)}, {(0,3),(1,2)}}
    */
    function generateSparseSecretSpace() {
    	var secretSpace = new Array();
	    for (let i = 0; i < keySize; i++) {
	        for (let j = 1; j <= valSize; j++) {
	            var tmp = new Array(keySize).fill(0);
	            tmp[i] = j;
	            secretSpace.push(tmp);
	        }
	    }
	    return secretSpace;
    }

	/*******************************************************************************
	 CONSTRUCTOR and PRIVATE MEMEBERS
	*******************************************************************************/
    var challenge = null;
    var secret = null;
}