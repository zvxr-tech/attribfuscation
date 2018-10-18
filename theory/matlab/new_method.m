% We want to know what the average probability of success for an adversary 
% to randomly select the correct secret after viewing a random 
% challenge-response and then being presented with a second, random challenge.

% To solve this, we will recursively decompose the probabilities involved.
% Given a system with K attribute types and V attribute values per type and
% some 1-digit (for simplicity) secret S ,
% suppose the adversary views some random challenge-response C1-R1, and 
% is presented with a second challenge C2.

% There will exist an element from C2 that contains the attribute
% type-value of the single digit secret S.
% There is a (1/V)^(K-1) probability that all of the attributes in the C2 element
% containing S are the exact same attribute type-values in the original
% challenge C1, in which case the adverary will know with 100% certainty,
% (1/V)^K  of the time.

% Similarly, there is a (1/V)^(K-2) probability that ALL BUT ONE of the 
% attributes in the element containing S are in the original challenge C1.
% However, in this case the adversary will only be 50% certain which of the
% two elements in C2 contain the actual secret S from the set of attributes
% in the original response element R1 of C1.

% Byond these two base cases, we calculate the probability of the adversary
% having knowledge in a similar fashion, but we recursively calculate the
% probabilities of success over the different ways that the "missing"
% attributes from C1 element are distributed over the remaining C2
% challenge elementes that have not been considered.

% We can ignore the actual ordering of the challenge elements, but not the
% element contents (attribute key-values). We leverage this to ignore
% ordering.


% TODO: Test handling of non-equal grid and attribute value sizes

min_key = 1;
max_key = 9;
min_val = 1;
max_val = 9;


final = [];
for v = min_val : max_val
    for k = min_key : max_key
        g = v; % set grid size the same as val size
        result = wrapper(k, v, g, 1);
        fprintf('%d\t%d\t%f\n', k, v, result);
        final(k,v) = result;
        final_compare(k,v) = (result / (1/v));
    end
end

figure;
surf(final);
figure;
surf(final_compare);
final_compare
%fig2plotly();

function accum = partial(missing, key, val, grid, depth) 
    if missing == 0
        accum = ((1 / val) ^ (key - (missing + 1))) / depth;
    elseif missing == 1 
            accum = ((1 / val) ^ (key - (missing + 1))) * (1-(1 / val)) * (1 / (depth + 1));
    else
        accum = ((1 / val) ^ (key - (missing + 1))) * (1-(1 / val)) * (wrapper(missing, val - 1, grid - 1, depth + 1));
    end
end

function accum = wrapper(key, val, grid, depth)    
    if val == 1 || grid == 1
        accum = 1 / depth;
        return;
    end
    
    accum = 0;
    for i = 0 : (key - 1)
        tmp_accum = partial(i, key, val, grid, depth);
        accum = accum + tmp_accum;
    end
end
