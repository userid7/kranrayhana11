var countdown = 0;
var trig = false;
var checkk = document.getElementById('trigcheck');


const container = "slider";

transportation = new CircularSlider({container, color: '#1ECB8D',max: 60, min: 0, step: 1, radius: 180, valueChange: val => updateVal('counterr', val)});
transportation.stepNo = '0';

function defineColor(newColor, countdown){
	transportation.stepNo = 0;
	delete transportation
	transportation = new CircularSlider({container, color: newColor, max: 60, min: 0, step: 1, radius: 180, valueChange: val => updateVal('counterr', val)});
	transportation.stepNo = countdown;
	
}

function updateVal(divId, val){
	if(trig === true){
		transportation.stepNo = countdown;
		document.getElementById(divId).getElementsByClassName("amount")[0].innerHTML = countdown;

	}
	else {
		document.getElementById(divId).getElementsByClassName("amount")[0].innerHTML = val;	
	}
}

var databaseRef = firebase.database().ref('rumah/');

databaseRef.once('value', function(snapshot) {
   trig = snapshot.child('trigger').val();
	countdown = snapshot.child('countdown').val();

	if(trig == true){
		transportation.stepNo = countdown;
		/// nyalain check box
	}
	else{
		countdown = 0;
		var data = {
    		'countdown': countdown,
    		'trigger' : trig
    	}
		firebase.database().ref().child('/rumah').update(data);
	}
	
	
	checkk.checked = trig;
	colortrig();
	

   document.getElementById('tess').innerHTML = "Connected";
   

  });

databaseRef.on('value', function(snapshot) {
	trig = snapshot.child('trigger').val();
	countdown = snapshot.child('countdown').val();

	transportation.stepNo = countdown;
	checkk.checked = trig;
	colortrig();
	
  });


function check(){
	if(document.getElementById('trigcheck').value=="Start"){
		trig = true;
		
		countdown = transportation.currentValue;
		//document.getElementById("slider").style.visibility = "hidden"; //animasi improve, kalau semisal butuh dihide dulu buat transisi
		setTimeout(function(){defineColor('#EA7052', countdown)}, 100);
		//setTimeout(function(){document.getElementById("slider").style.visibility = "visible"}, 500); //animasi improve, kalau semisal butuh dihide dulu buat transisi

		var data = {
    		'countdown': countdown,
    		'trigger' : trig
    	}
		firebase.database().ref().child('/rumah').update(data);
		document.getElementById('counterr').style.color = "#EA7052";
		checkk.value="Filling the water..."
		checkk.style.backgroundColor = "#EA7052";
		//document.getElementById(divId).getElementsByClassName("amount")[0].style.color= 'black';
		
	}
	else{
		trig = false;
		countdown = 0;
		defineColor('#1ECB8D', countdown)
		transportation.stepNo = countdown;
		
		var data = {
    		'countdown': countdown,
    		'trigger' : trig
    	}
		firebase.database().ref().child('/rumah').update(data);
		document.getElementById('counterr').style.color = "#FEFEFF";
		checkk.value="Start"
		checkk.style.backgroundColor = "#1ECB8D";
	}
}

function colortrig(){
	if(trig == true){
		document.getElementById('counterr').style.color = "#EA7052";
	}
	else {
		document.getElementById('counterr').style.color = "#FEFEFF";
	}
}
