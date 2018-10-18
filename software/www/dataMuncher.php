<html><body><?php
	//NOTE:  php.ini - You should probably increas max post size and max upload size as well as increased memory size to accomodate for upload sizes
	// The Telemeter generates 8 bytes per event, assuming 1 event (very liberal) per ms, this means that a 30 min study would require ~ 14MB. In practice, this will be less.

	//START: USER-DEFINED VARIABLES
	$validReferer = 'INSERT_VALID_REFERER';
	$validReferer2 = $validReferer . 'study.html';
	$dataDir = 'INSERT_VALID_DATADIR'; // this pre-existing folder should have o+xw Linux file permissions set
	$backupOutfilename = $dataDir . 'lost.dat';
	$logfilename = $dataDir . 'dataMuncher.log';
	//END: USER-DEFINED VARIABLES


	if (validReferer == 'INSERT_VALID_REFERER' || dataDir == 'INSERT_VALID_DATADIR') {
		header( "Location: $validReferer" );
		header('X-PHP-Response-Code: 500', true, 500);
	} else {
		chmod($logfilename, 0600);
		$curtime = time();
		if ($_SERVER['HTTP_REFERER'] != $validReferer && $_SERVER['HTTP_REFERER'] != $validReferer2) {
			// throw a decoy redirect up
			error_log("[$curtime] Invalid referer: " . $_SERVER['HTTP_REFERER'] . "\n", 3, $logfilename);	
		//	header( "Location: $validReferer" ) ;
		} else if (empty($_SERVER['HTTPS'])) {
			error_log("[$curtime] Invalid protocol\n", 3, $logfilename);	
		//	header( "Location: $validReferer" ) ;
		} else {
			$in = fopen('php://input', 'rb');
			if ($in === FALSE) {
				error_log("Failed to open input stream.\n" , 3, $logfilename);
			} else {
				$out = FALSE;

				do {
					$Huid =  hash('sha256',(string) time()  . $_SERVER['REMOTE_ADDR'] . (string) rand() . $_SERVER['HTTP_USER_AGENT'] . $_SERVER['REQUEST_TIME_FLOAT']);
					$uid = str_replace ("/" , "", $Huid);

					$outfilename = $dataDir  . $uid . '.dat';
					$out = fopen($outfilename, 'xb');
				} while ($out === FALSE && --$maxtry > 0);

				$bytes = FALSE;
				if ($out === FALSE) {
					// could not open random filename. Attempt to append to a backup file.
					error_log("[$curtime] Failed to open file for output. Attempting to open backup file\n", 3, $logfilename);	
					$outfilename = $backupOutfilename;
					
					chmod($outfilename, 0600);
					$maxtry = 3;
					while ($bytes === FALSE && $maxtry-- > 0)
						$bytes = file_put_contents($outfilename, $in, FILE_APPEND | LOCK_EX);
					chmod($outfilename, 0);
				} else {
					$bytes = stream_copy_to_stream($in, $out);
					chmod($outfilename, 0);
					fclose($out);
				}
				chmod($outfilename, 0);				
				fclose($in);

				if ($bytes === FALSE) {
					error_log("[$curtime] Failed write\n", 3, $logfilename);	
				} else {	
					error_log("[$curtime] Wrote $bytes bytes.\n", 3, $logfilename);	
				}
			}
		}
		chmod($logfilename, 0);
	}
?></body></html>