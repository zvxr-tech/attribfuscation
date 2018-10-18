
main()
function working_version()
GRID_SIZE = 3;



i=3;
j=3;
secret_perm = [1,6,9]
challenges = [1 2 3; 2 3 1; 3 1 2; 2 2 3; 1 1 2; 3 3 1]
secret_matrix = secret2attr(secret_perm, i, j)
%for a given secret and set of challenges

    response1 = zeros(size(challenges, 1), size(challenges, 2));
    for secret_i = 1:size(secret_matrix, 1)
        % we make sure to cast the result from logical to double
        response1 = response1 + +(challenges(:,:) == secret_matrix(secret_i,:));
    end
    response1
    response_sum = sum(response1,2)
    polynomial = zeros(2,2,10) % TODO parameterize 
    % for each challenge-response (grouping of 3 rows in resonse1),
    for response1_i = 1 :GRID_SIZE: size(response1, 1) %step 
        current_challenge1_enum = ceil(response1_i / GRID_SIZE);

        response2 = zeros(size(challenges, 1), size(challenges, 2));
        % extract the response matches for a given challenge
        for response1_j = 0 :(GRID_SIZE - 1)
            %%%for response1_k = 1 : response_sum(response1_i + response1_j)
                % response2 will contain the rows of challenge2 that
                % are possible solutions, given challenge1-response1
                if response_sum(response1_i + response1_j) ~= 0
                    response2_hit = +(challenges(:,:) == challenges(response1_i + response1_j,:))


                    temp = sum(response2_hit(:,:) ~= 0, 2); % determine which rows in the challenge had matches
                    temp(temp ~= 0) = 1; % convert all non-zero values to 1
                    % temp now contains a single column where the value at each
                    % row corresponds to 
                     %iterate voer every challenge2 to see how challenge1 influenced
                     % the possible correct responses
                     for temp_i = 1 : GRID_SIZE: size(temp,1)
                        current_challenge2_enum = ceil(temp_i / GRID_SIZE);
                        temp_sub = sum(temp(temp_i:temp_i + GRID_SIZE - 1)) % TODO check for off-by1
                        polynomial(current_challenge1_enum, current_challenge2_enum, temp_sub) = polynomial(current_challenge1_enum, current_challenge2_enum, temp_sub)  + response_sum(response1_i + response1_j);
                        %response2_hit_sub = response2_hit(response_hit_i:response_hit_i+ATTR_GRID_SIZE);

                        % START HERE: save polynomial for and then take the average over
                        % everything

                        %hit_count 
                        %if on last row for a given challenge-response row grouping
                        %if mod(response2_hit_i, 3) == 0
                            % polynomial(CHALLENGE1_ENUM, CHALLENGE2_ENUM, EXPONENT
                           % polynomial(current_challenge1_enum, current_challenge2_enum, 
                       % end
                     end
                end
            %%%end
        end
    end

display(polynomial)
end


function main()
    %mutable parameters
    MIN_KEY_SIZE = 3;
    MIN_GRID_SIZE = 4;

    MAX_KEY_SIZE = 3;
    MAX_GRID_SIZE = 4;

    MIN_SECRET_SIZE = 1;
    MAX_SECRET_SIZE = 1;

    %immutable parameters
    MAX_VAL_SIZE = MAX_GRID_SIZE;
   
    % iterate over all possible system-parameters (attribute key count, val count
    % and grid size), challenges for each are pre-computed and stored with
    % the system parameters encoded into the filename
    for key_size = MIN_KEY_SIZE: MAX_KEY_SIZE
        for grid_size = MIN_GRID_SIZE: MAX_GRID_SIZE %attr_val_cnt
            val_size = grid_size;
            filename = strcat(num2str(key_size), '_', num2str(grid_size), '.mat');
            display(filename);
            clear('final');
            load(filename);
            challenges = final;
            
            secret_space = 1:key_size * val_size
            polynomial = []; % this will get allocated below for every secret, of every length
            %iterate over every password length
            for secret_size = MIN_SECRET_SIZE:MAX_SECRET_SIZE
                % build up matrix of every possible password of length
                % secret_size, and iterate over it
                secrets = nchoosek(secret_space, secret_size);
                for secrets_i = 1 : size(secrets,1)
                    %for a given secret and set of challenges
                    % convert the secret to a format that can be easilly
                    % used to operate on the challenges matrices to generate
                    % response matrices
                    secret_perm = secrets(secrets_i,:);
                    secret_matrix = secret2attr(secret_perm, key_size, grid_size);
                       
                                       % prepare an empty array to hold the terms that compute the 
                    % probability for a given system parameters (attribute
                    % key and value count/ grid size) for all possible
                    % passwords of a given length for the system parameters
                    % POLYNOMIAL prototype = (challenge1 enum, challenge2
                    % enum, base)
                    % For example to store the polynomial (1/2)^4 * (1/3)^5
                    % * 1^6
                    % for attribute val=key=grid_size=3
                    % POLYNOMIAL = [6, 4, 5]
                    clear polynomial;
                    polynomial = zeros(1, size(challenges,1) / grid_size, size(secret_space,2)); 
                    %polynomial = zeros(size(challenges,1) / grid_size, size(challenges,1) / grid_size, size(secret_space,2)); 
                    
                    % prepare an empty response matrix, and populate it
                    % with the responses to the challenge matrix for the 
                    % specified attribute key count and value count/grid
                    % size parameters.
                    response1 = zeros(size(challenges, 1), size(challenges, 2));
                    for secret_i = 1:size(secret_matrix, 1)
                        % we make sure to cast the result from logical to double
                        response1 = response1 + +(challenges(:,:) == secret_matrix(secret_i,:));
                    end
                    
                    % the response sum will be a single column, whose row index is one
                    % of the grid elements in the challenge. Each GRID_SIZE rows
                    % form one response to a challenge. 
                    % The value of each element in the response_sum matrix
                    % is the number of times that challenge row was entered
                    % as a solution to the challenge (button was pressed)
                    %
                    % resonse_sum shares row index with response1, so we
                    % can still recover the actual attribute key-value
                    % pairs that were lost in the summation of response1
                    response_sum = sum(response1,2);
                    
 
                    % iterate over each challenge-response (grouping of 3 rows in resonse1),
                    for response1_i = 1 :grid_size: size(response1, 1) %step 
                        current_challenge1_enum = ceil(response1_i / grid_size);

                        response2 = zeros(size(challenges, 1), size(challenges, 2));
                        
                        % extract the response matches for a given challenge
                        for response1_j = 0 :(grid_size - 1)
                            % response2 will contain the rows of challenge2 that
                            % are possible solutions, given challenge1-response1
                            if response_sum(response1_i + response1_j) ~= 0
                                response2_hit = +(challenges(:,:) == challenges(response1_i + response1_j,:));


                                temp = sum(response2_hit(:,:) ~= 0, 2); % determine which rows in the challenge had matches
                                temp(temp ~= 0) = 1; % convert all non-zero values to 1
                                % temp now contains a single column where the value at each
                                % row corresponds to 
                                 %iterate voer every challenge2 to see how challenge1 influenced
                                 % the possible correct responses
                                 for temp_i = 1 : grid_size: size(temp,1)
                                    current_challenge2_enum = ceil(temp_i / grid_size);
                                    temp_sub = sum(temp(temp_i:temp_i + grid_size - 1)); % TODO check for off-by1
                                    %current_challenge1_enum
                                    %current_challenge2_enum
                                    %temp_sub
                                    %response1_i 
                                    %response1_j
                                    %size(response1)
                                    if current_challenge1_enum == 1
                                        polynomial(current_challenge1_enum, current_challenge2_enum, temp_sub) = polynomial(current_challenge1_enum, current_challenge2_enum, temp_sub)  + response_sum(response1_i + response1_j);
                                    end

                                    % START HERE: save polynomial for and then take the average over
                                    % everything
                                 end
                            end
                        end
                    end
                % after all the challenge1-response1-challenge2
                % probabilities have been calculated into polynomial,
                % we need to transpose the 
                %display(polynomial)
                fprintf('\nSECRET =%d (%d)\n',secret_size, secrets_i);
                fprintf('C1\tC2\t');
                for poly_k = 1 : size(polynomial, 3)
                    fprintf('\tT%d', poly_k);
                end
                fprintf('\n');
                for poly_i = 1 : size(polynomial, 1)
                    for poly_j = 1 : size(polynomial, 2)
                       fprintf('%d\t%d\t\t', poly_i, poly_j);
                       
                       for poly_k = 1 : size(polynomial,3)
                            fprintf('%s\t', string(polynomial(poly_i, poly_j,poly_k)));
                        end
                       fprintf(string('\n'));
                    end
                    summation = sum(squeeze(polynomial(1,:,:)),1)
                    sum(summation)
                    
                end
                % 
                end
            end
        
        end
    end
end

% Takes in a secret vector, where each element value is the linear index
% into a model with attribute keys as row indices and attribute values as 
% the column.

% Return a matrix where the column index is the attribute key
% and the element value is the attribute value for that key.
% 
% Ex. Attribute keys count = Atribute value count = grid size = 3
%
% Each key-value attribute pair can be expressed as a number [1:9]
% Let, secret = [1, 6, 9] 
% (meaning 1st attribute key, 1st value of that attribute; folllowed by,
%  2nd attribute key, 2nd value of that attribute; followed by,
%  3rd attribute key, 3rd value of that attribute.)
% Will yield the following return matrix:
% [1, 0, 2; 
%  0, 0, 3]
% This can then be compared against the challenge matrix to form a response
% matrix based on the secret attribute matrix this function generates.
function ret = secret2attr(S, attr_key_cnt, attr_val_cnt)
    ret = zeros(1, attr_key_cnt);
    for ii = 1:length(S)
           %attr_key = ceil(S(i)/attr_key_cnt);
           %attr_val = mod(S(i), attr_key_cnt);
           [key, val] = ind2sub([attr_key_cnt, attr_val_cnt], S(ii));
           jj = 1;
           while ret(jj,key) ~= 0
               jj = jj + 1;
           end
           ret(jj,key) = val;
           % adds a row of zeros if one does not exist, nothing otherwise
           if jj + 1 > size(ret, 1)
               ret = [ret ;zeros(1,attr_key_cnt)];
           end
         
    end
    ret = ret(1:end-1,:); % remove the last row of zeros
end