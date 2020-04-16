$(document).ready(function() {	
	$('.progress').progress().hide();
	$('.ui.sidebar').sidebar('attach events', '.toc.item');
});


var record = document.querySelector('.record');
var soundClips = document.querySelector('.sound-clips');
var mediaRecorder = {};
var hasStarted = false, isFirstTime = true, isUploading = false;
var canvas = document.querySelector('.visualizer');
var audioCtx = new (window.AudioContext || webkitAudioContext)();
var canvasCtx = canvas.getContext("2d");



if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
   console.log('getUserMedia supported.');
   
   navigator.mediaDevices.getUserMedia ({audio: true})
      .then(function(stream) {
 		var mediaRecorder = new MediaRecorder(stream);
        var chunks = [];		

        // housekeeping for initial display of audio clips list
        soundClips.innerHTML = "Nothing to display yet.";

        // Starting audio visualizer
        visualize(stream);
        
        // Toggle button for record/stop
        record.onclick = function() {
        	// Fix for audiocontext not starting (sound visualizer not initiating)
        	if (audioCtx.state !== 'running'){
        		audioCtx.resume();
        	}

        	if (!isUploading){
	        	if (!hasStarted) {
	        		mediaRecorder.start();
					console.log(mediaRecorder.state);
					
					record.innerHTML = "Stop";
					record.style = "background-color: red";
					hasStarted = true;
	        	} else {
					mediaRecorder.stop();
			  		console.log(mediaRecorder.state);

	        		record.innerHTML = "Record";
					record.style = "";
					hasStarted = false;
	        	}
	        } else {
	        	console.log("Please wait until the previous clip finishes uploading");
	        }
		  
		}

        // MediaRecorder event handlers
		mediaRecorder.ondataavailable = function(e) {
		  chunks.push(e.data);
		}

		mediaRecorder.onstop = function(e) {
		  // Generating sound clip visual item
		  var clipName = getFileName('webm');
		  var clipContainer = document.createElement('article');
		  var clipLabel = document.createElement('p');
		  var audio = document.createElement('audio');
		           
		  clipContainer.classList.add('clip');
		  audio.setAttribute('controls', '');
		  clipLabel.innerHTML = clipName;
		  clipContainer.appendChild(audio);
		  clipContainer.appendChild(clipLabel);

		  // Clearing the placeholder text for the initial display
		  if (isFirstTime){
		  	soundClips.innerHTML = "";
		  	isFirstTime = false;	
		  }

		  soundClips.appendChild(clipContainer);

		  // Generating Blob and setting up audio URL
		  var blob = new Blob(chunks, { 'type' : 'audio/webm; codecs=opus' });
		  chunks = [];
		  var audioURL = window.URL.createObjectURL(blob);
		  audio.src = audioURL;

		  // Generating file for upload to server
		  uploadToServer(clipName, blob);
		}
      })

      // Error callback
      .catch(function(err) {
         console.log('The following getUserMedia error occured: ' + err);
      }
   );
} else {
   console.log('getUserMedia not supported on your browser!');
}

/****** Utils ******/

// Upload audio file to server
function uploadToServer(filename, file){
	var fileObject = new File([file], filename, {
	    type: 'video/webm'
	});

	var formData = new FormData();
    formData.append('video-blob', fileObject);
    formData.append('video-filename', fileObject.name);
    var url = 'https://rsundberg.ca/user_audio/save.php';

    $.ajax({
    	url: url,
    	type: 'post',
    	cache: false,
        contentType: false,
        processData: false,
    	data: formData,
    	beforeSend: function(){
    		$('.progress').show();
    		isUploading = true;
    	},
    	xhr: function() {
    		var xhr = $.ajaxSettings.xhr();
	        xhr.upload.onprogress = function (e) {
	            if (e.lengthComputable) {
	                $(".progress").progress({
	                	percent: e.loaded / e.total 
	                })
	            }
	        };
	        return xhr;
    	}
    }).done(function(response){
    	if (response === 'success'){
    		$('.progress').progress('complete');
    		$('.progress').progress('set label', 'Upload successful!');	
    	} else {
    		$('.progress').addClass('error');
    		$('.progress').progress('set label', 'There was an error uploading your file. Please try again');	
    	}
    	isUploading = false;
    }).fail(function(){
    	$('.progress').addClass('error');
    	$('.progress').progress('set label', 'There was an error uploading your file. Please try again');
    	isUploading = false;
    });    
}

// Generate random file name
function getFileName(fileExtension) {
    var d = new Date();
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
	var date = d.getUTCDate();
    return 'RecordRTC-' + year + month + date + '-' + getRandomString() + '.' + CLIENT_IP + '.' + fileExtension;
}

// Generate a random string
function getRandomString() {
    if (window.crypto && window.crypto.getRandomValues && navigator.userAgent.indexOf('Safari') === -1) {
        var a = window.crypto.getRandomValues(new Uint32Array(3)),
            token = '';
        for (var i = 0, l = a.length; i < l; i++) {
            token += a[i].toString(36);
        }
        return token;
    } else {
        return (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
    }
}

// Audio visualizer
function visualize(stream) {
  var source = audioCtx.createMediaStreamSource(stream);

  var analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  var bufferLength = analyser.frequencyBinCount;
  var dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);
  //analyser.connect(audioCtx.destination);

  draw()

  function draw() {
    WIDTH = canvas.width
    HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(255, 255, 255)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    var sliceWidth = WIDTH * 1.0 / bufferLength;
    var x = 0;


    for(var i = 0; i < bufferLength; i++) {
 
      var v = dataArray[i] / 128.0;
      var y = v * HEIGHT/2;

      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();

  }
}
