var countdown = 0;
var trig = false;
var checkk = document.getElementById('trigcheck');


const container = "slider";
function updateVal(divId, val){
	if(trig === true){
		transportation.stepNo = countdown;
		document.getElementById(divId).getElementsByClassName("amount")[0].innerHTML = countdown;

	}
	else {
		document.getElementById(divId).getElementsByClassName("amount")[0].innerHTML = val;	
	}
}
const transportation = new CircularSlider({container, color: '#EA7052',max: 60, min: 0, step: 1, radius: 180, valueChange: val => updateVal('counterr', val)});
// const food = new CircularSlider({container, color: "#127fc3", min: 10, max: 20, step: 2, radius: 160, valueChange: val => { updateVal('food', val)}});
// // const insurance = new CircularSlider({container, color: "#22a823", min: 500, max: 9000, step: 100, radius: 130, valueChange: val => updateVal('insurance', val)});
// const entertainment = new CircularSlider({container, color: "#fd8123", min: 5, max: 30, step: 5, radius: 100, valueChange: val => updateVal('entertainment', val)});
// // const healthCare = new CircularSlider({ container, color: "#fd3b3f", min: 0, max: 4, step: 1, radius: 70, valueChange: val => updateVal('health-care', val)});

//updateVal('counterr', transportation.currentValue);
// updateVal('food', food.currentValue);
// updateVal('insurance', insurance.currentValue);
// updateVal('entertainment', entertainment.currentValue);
// updateVal('health-care', healthCare.currentValue);

transportation.stepNo = '0';
// food.stepNo = 4;
// insurance.stepNo = 65;
// entertainment.stepNo = 3;
// healthCare.stepNo = 1;

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
	
	
	colortrig();
	checkk.setAttribute('onclick','check()');
	

   document.getElementById('tess').innerHTML = "Connectedd";
   

  });

databaseRef.on('value', function(snapshot) {
	trig = snapshot.child('trigger').val();
	countdown = snapshot.child('countdown').val();

	transportation.stepNo = countdown;
// 	checkk.checked = trig;
	colortrig();
	
  });


function check(){
	if(document.getElementById('trigcheck').value=="Start"){
		trig = true;
		
		countdown = transportation.currentValue;

		var data = {
    		'countdown': countdown,
    		'trigger' : trig
    	}
		firebase.database().ref().child('/rumah').update(data);
		document.getElementById('counterr').style.color = "#EA7052";
		checkk.value="Filling the water..."
		checkk.style.backgroundColor = "#EA7052";
		document.getElementById(divId).getElementsByClassName("amount")[0].style.color= 'black';	
	}
	else{
		trig = false;
		transportation.stepNo = 0;
		countdown = 0;
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
		checkk.value="Filling the water...";
		checkk.style.backgroundColor = "#EA7052";
// 		document.getElementById(divId).getElementsByClassName("amount")[0].style.color= 'black';
	}
	else {
		document.getElementById('counterr').style.color = "#FEFEFF";
		checkk.value="Start";
		checkk.style.backgroundColor = "#1ECB8D";
	}
}
