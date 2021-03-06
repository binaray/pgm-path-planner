'use strict'
let log = console.log.bind(console);
//DOM references
const canvas = document.getElementById('canvas');
const output = document.getElementById('output');
const ctx = canvas.getContext('2d');

//rviz yaml params (to retrieve from file)
const origin_offset_x = -90.830627;
const origin_offset_y = -60.027795;
const resolution = 0.05;

//runtime variables and output
let mousePos;
let savedWaypoints = new Waypoints();
// let selectedWaypointIndex;
const selectedWaypointIndex={
	set current(index){
		this._index=index;
		updateSelectedWaypointUi();
	}, 
	get current(){
		return this._index;
	},
	_index: null
};

/*/
//SAMPLE PGM FILE FORMAT//
P5
# CREATOR: GIMP PNM Filter Version 1.1
2048 2048
255
<data>
/*/

// if (canvas.getContext) {
	// let imageData = ctx.createImageData(100, 50);	//rectangle size
	// log(imageData);
	
	// // Iterate through every pixel
	// for (let i = 0; i < imageData.data.length; i += 4) {
		// // Modify pixel data
		// imageData.data[i + 0] = 190;  // R value
		// imageData.data[i + 1] = 0;    // G value
		// imageData.data[i + 2] = 210;  // B value
		// imageData.data[i + 3] = 255;  // A value
	// }

	// // Draw image data to the canvas
	// ctx.putImageData(imageData, 0, 0);	//rectangle position
// }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exportSavedWaypoints(){
	log(JSON.stringify(savedWaypoints.exportToRvizWaypoints()));
}

function deleteSelectedWaypoint(){
	if (selectedWaypointIndex.current!=null){
		savedWaypoints.removeWaypoint(selectedWaypointIndex.current);
		updateScene();
	}
}

function updateSavedWaypointListUi(){
	let waypoints = savedWaypoints.waypoints;
	const point_list = document.getElementById("point_list");
	for (let i=0;i<waypoints.length;i++){
		let li= document.createElement("li");
		li.appendChild(document.createTextNode(i));
		if (i>=point_list.childElementCount){
			point_list.appendChild(li);
		}
		else{
			point_list.replaceChild(li,point_list.childNodes[i]);
		}
	}
}

function updateSelectedWaypointUi(){
	document.getElementById("property_id").innerHTML=selectedWaypointIndex.current;
}

function updateScene(){
	updateSavedWaypointListUi();
	updateSelectedWaypointUi();
	ctx.putImageData(imageData, 0, 0);
	savedWaypoints.draw();
}

//-- pgm file data--//
let fileType="";
let hv="";
let maxWhiteVal="";
let imageData;
//------------------//
let fr = new FileReader();
fr.onload = async function(e) {
	let bytes = new Uint8Array(fr.result);
	let line=0;
	let dataI=0;
	
	for (let i=0; i<bytes.length; i++){
		//newline check- save header info respectively
		if (bytes[i]==10){
			line++;
			if (line==1) {
				log("Filetype: "+fileType);
				if (fileType!="P5") {
					log("Unhandled file type: "+fileType);
					return;
				}
			}
			else if (line==3){
				hv=hv.split(" ");
				canvas.width=hv[0];
				canvas.height=hv[1];
				imageData = ctx.getImageData (0, 0, hv[0], hv[1]);
				log("Dimensions: "+hv[0]+"x"+hv[1])
			}
			else if (line==4){
				log("Max White Value: "+maxWhiteVal);
			}
			continue;
		}
		
		//check line data
		//PGM format
		if (line==0){
			fileType+=String.fromCharCode(bytes[i]);
		}
		//file comments/metadata
		else if (line==1){
		}
		//size: horizontal & vertical
		else if (line==2){
			hv+=String.fromCharCode(bytes[i]);
		}
		//max white value
		else if (line==3){
			maxWhiteVal+=String.fromCharCode(bytes[i]);
		}
		//data
		else{
			// Iterate through every pixel
			if (dataI < imageData.data.length) {
				let val=maxWhiteVal*bytes[i]/maxWhiteVal;
				// Modify pixel data
				imageData.data[dataI + 0] = val;	// R value
				imageData.data[dataI + 1] = val;	// G value
				imageData.data[dataI + 2] = val;	// B value
				imageData.data[dataI + 3] = maxWhiteVal;	// A value
				dataI+=4;
			}
		}
		//await sleep(1000);
	}
	// Draw image data to the canvas
	ctx.putImageData(imageData, 0, 0);	//rectangle position
}

function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}
function getRvizPoint(mousePos){
	return new Point(
		mousePos.x * resolution + origin_offset_x,
		(canvas.height - mousePos.y) * resolution + origin_offset_y
	);
}

/*----------------------
//---Canvas listeners---
//---------------------*/
canvas.addEventListener('mousemove', function(evt) {
	mousePos = getMousePos(canvas, evt);
	let rvizPos = getRvizPoint(mousePos);
	let message = "(" + rvizPos.x + ", " + rvizPos.y + ")";
	
	if (translateWaypointFlag){
		savedWaypoints.setWaypointPosition(selectedWaypointIndex.current,mousePos.x,mousePos.y);
		updateScene();
	}
	//log(message);
}, false);

let isMouseDown=false;
let addWaypointFlag=false;
let translateWaypointFlag=false;

canvas.addEventListener('mousedown', function(evt) {
	isMouseDown=true;
	let rvizPoint = getRvizPoint(mousePos);
	
	let hits=savedWaypoints.hit(mousePos);
	if (hits.length>0){
		log(hits);
		selectedWaypointIndex.current=hits[0];
		checkMouseHold();
		//start timer to check hold time
	}
	else{ 
		if (selectedWaypointIndex.current!=null){
			selectedWaypointIndex.current=null;
		}
		else addWaypointFlag=true;
	}
	
}, false);
canvas.addEventListener('mouseup', function(evt) {
	if (isMouseDown && imageData!=null){
		if (addWaypointFlag){
			savedWaypoints.push(new Pose(mousePos));
			updateScene();
			addWaypointFlag=false;
		}
		else if (translateWaypointFlag){
			translateWaypointFlag=false;
		}
	}
	isMouseDown=false;
}, false);

let holdTime=0;
const editTriggerTime=500; //hold mouse down for --ms to trigger
async function checkMouseHold(){
	translateWaypointFlag=false;
	log("timer started");
	holdTime=0;
	while(holdTime<editTriggerTime){
		if (!isMouseDown){
			log("timer ended prematurely");
			return;
		}
		await sleep(5);
		holdTime+=5;
	} 
	
	//success
	log("flag activated");
	translateWaypointFlag=true;
}

function updateCanvas() {
	//10:/n 35:#
	fr.readAsArrayBuffer(this.files[0]);
}
document.getElementById("input").addEventListener("change", updateCanvas, false);

let importedPoints = [
	[2.83942,-0.735024],
	[-1.54533,-16.8608],
	[0.913047,-18.1805],
	[-5.60833,-26.4828],
	[-7.41272,-28.2688],
	[-10.9917,-28.2314],
	[-26.5198,-33.9047],
	[-38.6329,-33.8427],
	[-54.8156,-27.04],
	[-64.4659,-16.8349],
	[-68.6536,0.396617],
	[-68.500,9.97778],
	[-64.8986,20.58784],
	[-65.4986,23.811],
	[-56.3084,33.6803],
	[-48.3608,38.3622],
	[-36.7603,41.4135],
	[-23.2543,40.4517],
	[-10.4337,34.8497],
	[-1.93848,26.4883],
	[4.73231,13.8311],
	[6.02015,10.8273],
	[6.65513,7.85316],
	[7.0463,3.98162],
	[7.07469,0.707953]
]


function start(){
	for (let i=0;i<importedPoints.length;i++){
		let p = new Pose(new Point(importedPoints[i][0],importedPoints[i][1]));
		log(p);
		savedWaypoints.pushRvizPose(p);
	}
	updateScene();
}

