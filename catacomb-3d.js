
"use strict";

const LITTLE_ENDIAN = true;
const DEG_TO_RAD = Math.PI / 180;

const TILESIZE = 32;


// const player = {x: 13, y: 5, angle: 180};
const player = {x: 13, y: 13, angle: 180};
let map = null;
let ctx = null;
let canvas = null;
let ctx2 = null;
let textures = null;

let move = '';
let timer = 0;
let keyspressed = new Set();

let mouse_prev = { x: 0, y: 0 };
let mouse = { x: 0, y: 0 };

window.onload = main;
document.onkeydown = onkeydown;
document.onkeyup = onkeyup;
document.onmousemove = null;
document.onpointerlockchange = onpointerlockchange;

async function main() {

	canvas = document.getElementById("screen");
	canvas.onclick = function() { canvas.requestPointerLock(); }

	// canvas.width = 1000;
	// canvas.height = 1000;
	canvas.width = 720;
	canvas.height = 400;

	// const obs = new ResizeObserver(entries => {

	// 	if(entries[0].contentRect.width !== 0 && entries[0].contentRect.height !== 0) {
	// 		canvas.width = entries[0].contentRect.width;
	// 		canvas.height = entries[0].contentRect.height;
	// 	}
	// });
	// obs.observe(canvas);

	ctx = canvas.getContext("2d");
	ctx.imageSmoothingEnabled = false;

	ctx2 = document.getElementById("map").getContext("2d");

	const huffman_dict = Huffman_Create(grhuffman);

	const ega_buff = await Fetch_Buffer("EGAGRAPH.C3D");
	const tables = Tables_Create(ega_buff, huffman_dict);
	// const picture = Picture_Create(ega_buff, tables, EGA_CONST.ORC1PIC, huffman_dict);
	// ctx.putImageData(picture, 0, 0);

	// MAP
	const maps_buff = await Fetch_Buffer("GAMEMAPS.C3D");
	map = Map_Create(maps_buff, maphead.headeroffsets[0], maphead.RLEWtag);
console.log(map);
	const needed = Textures_Needed(map);
	textures = {};
	for(let id of needed) {
		textures[id] = Picture_Create(ega_buff, tables, 133 + id, huffman_dict);
	}

	window.requestAnimationFrame(run);
}



function run(timestamp) {

	window.requestAnimationFrame(run);

	const elapsed = (timestamp - timer) / 1000;
	timer = timestamp;

	update(elapsed);
	render();
}



function update(timeelapsed) {

	const tra_speed = 5;
	// const rot_speed = 60;

	for(let keycode of keyspressed) {
		if(keycode === 'KeyW') {
			player.x += cos(player.angle) * tra_speed * timeelapsed;
			player.y += sin(player.angle) * tra_speed * timeelapsed;
		}
		else if(keycode === 'KeyS') {
			player.x -= cos(player.angle) * tra_speed * timeelapsed;
			player.y -= sin(player.angle) * tra_speed * timeelapsed;
		}
		else if(keycode === 'KeyA') {
			// player.angle -= rot_speed * timeelapsed;
			// if(player.angle > 360) player.angle -= 360;
			player.x += cos(player.angle - 90) * tra_speed * timeelapsed;
			player.y += sin(player.angle - 90) * tra_speed * timeelapsed;
		}
		else if(keycode === 'KeyD') {
			// player.angle += rot_speed * timeelapsed;
			// if(player.angle < 0) player.angle += 360;
			player.x -= cos(player.angle - 90) * tra_speed * timeelapsed;
			player.y -= sin(player.angle - 90) * tra_speed * timeelapsed;
		}
	}

	// update angle
	player.angle += (mouse.x - mouse_prev.x) / 8;

	mouse_prev.x = mouse.x;
	mouse_prev.y = mouse.y;
}



function render() {

	ctx.beginPath();

	// draw floor and ceiling
	ctx.fillStyle = 'black';
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height / 2);
	ctx.fillStyle = 'darkgrey';
	ctx.fillRect(0, ctx.canvas.height / 2, ctx.canvas.width, ctx.canvas.height / 2);

	const intersect = [];
	const COLS = 90;
	const FOCAL_LENGTH = COLS / 2;	// this can be any number
	const COL_WIDTH = ctx.canvas.width / COLS;
	for(let col=0; col<COLS; col++) {

		let angle = 0;
		const focal = FOCAL_LENGTH / (COLS / 2 - col);
		if(col <= COLS / 2) {
			angle = player.angle - 90 + atan(focal);
		}
		else {
			angle = player.angle + 90 + atan(focal);
		}
		let i = Trace_Forward(player, -angle, map, map.header.width);
		if(i !== null) {
			intersect.push({ angle: angle, dist: i.dist });
			const dist = i.dist * cos(angle - player.angle);
			const tile = map.plane0[i.index];
			Draw_Column(col, dist, COL_WIDTH, tile, ctx);
		}
	}


	// render map
	ctx2.beginPath();
	ctx2.fillStyle = '#000';
	ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);

	ctx2.translate(ctx2.canvas.width / 2, ctx2.canvas.height / 2);
	const rot = -(player.angle + 90) * DEG_TO_RAD;
	ctx2.rotate(rot);

	ctx2.lineWidth = 1;
	Map_Draw(map, player.x * TILESIZE, player.y * TILESIZE, ctx2);

	ctx2.rotate(-rot);
	ctx2.fillStyle = 'yellow';
	ctx2.fillRect(-5, -5, 10, 10);

	ctx2.fillStyle = '#ffffd6';
	ctx2.moveTo(0, 0);
	for(let i of intersect) {
		const a = i.angle - (player.angle + 90);
		const d = i.dist * TILESIZE;
		ctx2.lineTo(cos(a) * d, sin(a) * d);
	}
	ctx2.lineTo(0, 0);
	ctx2.fill();

	ctx2.setTransform(1, 0, 0, 1, 0, 0);
}



function tan(angle) {
	return Math.tan(angle * DEG_TO_RAD);
}

function atan(value) {
	const rad = Math.atan(value);
	return rad / DEG_TO_RAD;
}

function sin(angle) {
	return Math.sin(angle * DEG_TO_RAD);
}

function cos(angle) {
	return Math.cos(angle * DEG_TO_RAD);
}

function acos(value) {
	const rad = Math.acos(value);
	return rad / DEG_TO_RAD;
}

function onkeydown(evt) {

	if(keyspressed.has(evt.code) === false) {
		keyspressed.add(evt.code);
	}
}

function onkeyup(evt) {
	if(keyspressed.has(evt.code) === true) {
		keyspressed.delete(evt.code);
	}
}

function onmousemove(evt) {
	// console.log(evt.movementX);
	mouse.x += evt.movementX;
	mouse.y += evt.movementY;
}


function onpointerlockchange(evt) {
	if (document.pointerLockElement === canvas) {
		console.log('The pointer lock status is now locked');
		document.onmousemove = onmousemove;
	}
	else {
		document.onmousemove = null;
	}
}


function Trace_Forward(player, angle, map, map_width) {
	const tilemap = map.plane0;

	const dirx = cos(angle);
	const diry = -sin(angle);

	const xstep = Math.sqrt(1 +  (diry / dirx) * (diry / dirx));
	const ystep = Math.sqrt(1 +  (dirx / diry) * (dirx / diry));

	let xtile = Math.floor(player.x);
	let ytile = Math.floor(player.y);

	let xtilestep;
	let ytilestep;

	let xintercept;
	let yintercept;

	// Establish Starting Conditions
	if (dirx < 0) {
		xtilestep = -1;
		xintercept = (player.x - Math.floor(player.x)) * xstep;
	}
	else {
		xtilestep = 1;
		xintercept = (Math.floor(player.x) + 1 - player.x) * xstep;
	}

	if (diry < 0) {
		ytilestep = -1;
		yintercept = (player.y - Math.floor(player.y)) * ystep;
	}
	else {
		ytilestep = 1;
		yintercept = (Math.floor(player.y) + 1 - player.y) * ystep;
	}

	let t = `xtile: ${xtile}<br>xtilestep: ${xtilestep}<br>ytile: ${ytile}<br>ytilestep: ${ytilestep}<br>xtile: ${xtile}<br>`

	// Perform "Walk" until collision or range check
	let tilehit = false;
	let steps = 0;
	let dist = 0;
	while (!tilehit && steps < map_width) {

		// Walk along shortest path
		if (xintercept < yintercept) {
			xtile += xtilestep;
			xintercept += xstep;
			if (tilemap[ytile * map_width + xtile] < 100) {
				tilehit = true;
				dist = xintercept - xstep;
			}
		}
		else {
			ytile += ytilestep;
			yintercept += ystep;
			if (tilemap[ytile * map_width + xtile] < 100) {
				tilehit = true;
				dist = yintercept - ystep;
			}
		}

		// should test ytile and xtile vs map_width and map_height here

		steps++;
	}

	// calc distance
	if(tilehit) {
		return { index: ytile * map_width + xtile, dist: dist };
	}
	else {
		return null;
	}
}


function Textures_Needed(map) {

	const needed = new Set();

	for(let tile of map.plane0) {
		if(tile < 33) needed.add(tile);
	}

	return needed;
}

function Draw_Column(index, dist, col_width, tile, ctx) {

	const COL_WIDTH = col_width;
	const COL_HEIGHT = 600;

	const height = COL_HEIGHT / dist;
	const color = 1 / (dist / 6) * 255;
	ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
	const x1 = index * COL_WIDTH;
	const y1 = (ctx.canvas.height - height) / 2;
	ctx.fillRect(x1, y1, COL_WIDTH, height);
}



function Tables_Create(ega_buff, huffman_dict) {

    // Initialize picture table
    const view = new DataView(ega_buff);

	const compressedSize = EGA_OFFSETS[1] - EGA_OFFSETS[0] - 4;
	const compressedPictureTable = new Uint8Array(ega_buff, EGA_OFFSETS[0] + 4, compressedSize);
	const uncompressedSize = view.getUint32(EGA_OFFSETS[0], LITTLE_ENDIAN);
	const pictureTableChunk = Huffman_Expand(compressedPictureTable, uncompressedSize, huffman_dict);

	const pictureTable = [];
	const pictureView = new DataView(pictureTableChunk.buffer);
	for (let i=0; i<pictureTableChunk.byteLength; i+=4) {
		const width = pictureView.getUint16(i, LITTLE_ENDIAN) * 8;
		const height = pictureView.getUint16(i + 2, LITTLE_ENDIAN);
		pictureTable.push({ width: width, height: height });
	}

    // // Initialize masked picture table
	const compressedSize2 = EGA_OFFSETS[2] - EGA_OFFSETS[1] - 4;
    const compressedMaskedPictureTable = new Uint8Array(ega_buff, EGA_OFFSETS[1] + 4, compressedSize2);
    const uncompressedSize2 = view.getUint32(EGA_OFFSETS[1], LITTLE_ENDIAN);
    const maskedPictureTableChunk = Huffman_Expand(compressedMaskedPictureTable, uncompressedSize2, huffman_dict);

	const maskedPictureTable = [];
	const maskedView = new DataView(maskedPictureTableChunk.buffer);
	for (let i=0; i<maskedPictureTableChunk.byteLength; i+=4) {
		const width = maskedView.getUint16(i, LITTLE_ENDIAN) * 8;
		const height = maskedView.getUint16(i + 2, LITTLE_ENDIAN);
		maskedPictureTable.push({ width: width, height: height });
	}

	// Initialize sprites table
	const compressedSize3 = EGA_OFFSETS[3] - EGA_OFFSETS[2] - 4;
	const compressedSpritesTable = new Uint8Array(ega_buff, EGA_OFFSETS[2] + 4, compressedSize3);
	const uncompressedSize3 = view.getUint32(EGA_OFFSETS[2], LITTLE_ENDIAN);
	const spritesTableChunk = Huffman_Expand(compressedSpritesTable, uncompressedSize3, huffman_dict);

	const spriteTable = [];
	const spriteView = new DataView(spritesTableChunk.buffer);
	for (let i=0; i<spritesTableChunk.byteLength; i+=18) {

		// typedef struct {
		// 	int	width, height, orgx, orgy, xl, yl, xh, yh, shifts;
		// } spritetabletype;

		const width = spriteView.getUint16(i, LITTLE_ENDIAN) * 8;
		const height = spriteView.getUint16(i + 2, LITTLE_ENDIAN);
		const orgx = spriteView.getUint16(i + 4, LITTLE_ENDIAN);
		const orgy = spriteView.getUint16(i + 6, LITTLE_ENDIAN);
		const xl = spriteView.getUint16(i + 8, LITTLE_ENDIAN);
		const yl = spriteView.getUint16(i + 10, LITTLE_ENDIAN);
		const xh = spriteView.getUint16(i + 12, LITTLE_ENDIAN);
		const yh = spriteView.getUint16(i + 14, LITTLE_ENDIAN);
		const shifts = spriteView.getUint16(i + 16, LITTLE_ENDIAN);
		spriteTable.push({ width: width, height: height, orgx: orgx, orgy: orgy, xl: xl, yl: yl, xh: xh, yh: yh, shifts: shifts });
	}
	return { pictures: pictureTable, masked: maskedPictureTable, sprites: spriteTable };
}


function Picture_Create(ega_buff, tables, index, huffman_dict) {

	const FIRST_INDEX = EGA_CONST.CP_MAINMENUPIC

	const view = new DataView(ega_buff);
	const pictureIndex = index - FIRST_INDEX;

	const transparent = ((index > EGA_CONST.FIRSTSCALEPIC) && (index < EGA_CONST.FIRSTWALLPIC));
	// const compressedSize = EGA_OFFSETS[index + 1] - EGA_OFFSETS[index];
	// to fix: create an array using compressedSize
	const compressedPicture = new Uint8Array(ega_buff, EGA_OFFSETS[index] + 4);
	const uncompressedSize = view.getUint32(EGA_OFFSETS[index], LITTLE_ENDIAN);
	const pictureChunk = Huffman_Expand(compressedPicture, uncompressedSize, huffman_dict);

	const imageWidth = tables.pictures[pictureIndex].width;
	const imageHeight = tables.pictures[pictureIndex].height;
	// const textureWidth = Picture::GetNearestPowerOfTwo(imageWidth);
	// const textureHeight = Picture::GetNearestPowerOfTwo(imageHeight);


	const bytesPerOutputPixel = 4;
	const numberOfPlanes = 4;
	const planeSize = uncompressedSize / numberOfPlanes;
	const numberOfEgaPixelsPerByte = 8;
	const numberOfPixels = planeSize * numberOfEgaPixelsPerByte;


	const img = ctx.createImageData(imageWidth, imageHeight);
	// Loop through each plane (4 planes total)
	for(let i=0; i<planeSize; i++) {

		// Loop through the whole height of the picture (in pixel)
		for(let bit=0; bit<numberOfEgaPixelsPerByte; bit++) {

			const bit_mask = (1 << bit);
			let b = ( ((pictureChunk[i + planeSize * 0] & bit_mask) > 0) ? 255 : 0 );
			let g = ( ((pictureChunk[i + planeSize * 1] & bit_mask) > 0) ? 255 : 0 );
			let r = ( ((pictureChunk[i + planeSize * 2] & bit_mask) > 0) ? 255 : 0 );
			let a = ( ((pictureChunk[i + planeSize * 3] & bit_mask) > 0) ? 255 : 128 );

			if(transparent && b === 255 && r === 255) {
				b = 0;
				g = 0;
				r = 0;
				a = 255;
			}

			const dst_offset = (i * numberOfEgaPixelsPerByte + numberOfEgaPixelsPerByte - bit) * 4;
			img.data[dst_offset + 0] = r;
			img.data[dst_offset + 1] = g;
			img.data[dst_offset + 2] = b;
			img.data[dst_offset + 3] = a;
		}
	}

    return img;
}


//========================================================================================================================
//  ___  ___  ___  ______
//  |  \/  | / _ \ | ___ \
//  | .  . |/ /_\ \| |_/ /
//  | |\/| ||  _  ||  __/
//  | |  | || | | || |
//  \_|  |_/\_| |_/\_|
//
//========================================================================================================================



function Map_Create(buffer, offset, rle) {

	// typedef	struct
	// {
	// 	long		planestart[3];
	// 	unsigned	planelength[3];
	// 	unsigned	width,height;
	// 	char		name[16];
	// } maptype;

	let data_view = new DataView(buffer);
	let header = {offPlane0: 0, offPlane1: 0, offPlane2: 0, lenPlane0: 0, lenPlane1: 0, lenPlane2: 0, width: 0, height: 0, name: ""};
	header.offPlane0 = data_view.getUint32(offset + 0, LITTLE_ENDIAN);
	header.offPlane1 = data_view.getUint32(offset + 4, LITTLE_ENDIAN);
	header.offPlane2 = data_view.getUint32(offset + 8, LITTLE_ENDIAN);
	header.lenPlane0 = data_view.getUint16(offset + 12, LITTLE_ENDIAN);
	header.lenPlane1 = data_view.getUint16(offset + 14, LITTLE_ENDIAN);
	header.lenPlane2 = data_view.getUint16(offset + 16, LITTLE_ENDIAN);
	header.width = data_view.getUint16(offset + 18, LITTLE_ENDIAN);
	header.height = data_view.getUint16(offset + 20, LITTLE_ENDIAN);

	const name = new Uint8Array(buffer, offset + 22, 16);
	let index = 0;
	while(index < name.length) {
		if(name[index] === 0) break;
		header.name += String.fromCharCode(name[index]);
		index++;
	}

	const map = { header: header, plane0: null, plane1: null, plane2: null };
	const size = header.width * header.height;

	let expanded_length = data_view.getUint16(header.offPlane0, LITTLE_ENDIAN);
	let carmack_data = new Uint8Array(buffer, header.offPlane0 + 2, header.lenPlane0 - 2);
	let expanded_data = Carmack_Expand(carmack_data, expanded_length);
	map.plane0 = Rlew_Expand(expanded_data.slice(1), size * 2, rle);

	expanded_length = data_view.getUint16(header.offPlane2, LITTLE_ENDIAN);
	carmack_data = new Uint8Array(buffer, header.offPlane2 + 2, header.lenPlane2 - 2);
	expanded_data = Carmack_Expand(carmack_data, expanded_length);
	map.plane2 = Rlew_Expand(expanded_data.slice(1), size * 2, rle);

	return map;
}



function Map_Draw(map, offset_x, offset_y, ctx) {

	ctx.font = "16px sans-serif";
	ctx.lineWidth = 1;

	// draw cells
	ctx.strokeStyle = 'white';
	let x = 0;
	while(x < map.header.width) {

		let y = 0;
		while(y < map.header.height) {

			const str_id = map.plane0[y * map.header.width + x];
			let color = 'black';
			switch(str_id) {
				case 1: color = 'darkgrey';
				break;
				case 2: color = 'darkgreen';
				break;
				case 3: color = 'lightgrey';
				break;
				case 4: color = 'darkgreen';
				break;
				case 5: color = 'brown';
				break;
				case 6: color = 'red';
				break;
				case 7: color = 'yellow';
				break;
				case 8: color = 'darkgrey';
				break;
				case 9: color = 'darkgreen';
				break;
				case 10: color = 'lightgrey';
				break;
				case 11: color = 'darkgreen';
				break;
				case 12: color = 'brown';
				break;
				case 13: color = 'red';
				break;
				case 14: color = 'yellow';
				break;
				case 20: color = 'red';
				break;
				case 24: color = 'yellow';
				break;
				case 28: color = 'green';
				break;
				case 32: color = 'blue';
				break;
			}

			ctx.fillStyle = color;
			ctx.fillRect(x * TILESIZE - offset_x, y * TILESIZE - offset_y, TILESIZE, TILESIZE);
			ctx.strokeRect(x * TILESIZE - offset_x, y * TILESIZE - offset_y, TILESIZE, TILESIZE);
			y++;
		}
		x++;
	}

	// draw tile values
	ctx.fillStyle = "white";
	x = 0;
	while(x < map.header.width) {
		let y = 0;
		while(y < map.header.height) {

			const str_id = map.plane0[y * map.header.width + x];

			let letter = "";
			switch(str_id) {
				case 8: letter = 'x';
				break;
				case 9: letter = 'x';
				break;
				case 10: letter = 'x';
				break;
				case 11: letter = 'x';
				break;
				case 12: letter = 'x';
				break;
				case 13: letter = 'x';
				break;
				case 14: letter = 'x';
				break;
				case 20: letter = 'd';
				break;
				case 24: letter = 'd';
				break;
				case 28: letter = 'd';
				break;
				case 32: letter = 'd';
				break;
			}

			if(letter !== "") {
				ctx.fillText(letter, x * TILESIZE + 4 - offset_x, y * TILESIZE + 18 - offset_y);
			}
			y++;
		}
		x++;
	}

	// draw entities values
	ctx.fillStyle = "yellow";
	x = 0;
	while(x < map.header.width) {
		let y = 0;
		while(y < map.header.height) {
			const ent_id = map.plane2[y * map.header.width + x];
			if(ent_id  !== 0) {
				ctx.fillText(ent_id, x * TILESIZE + 4 - offset_x, y * TILESIZE + 18 - offset_y);
			}
			y++;
		}
		x++;
	}
}



function Rlew_Expand(source, length, rlewtag) {

	let dest = [];
	let inptr = 0;
	let outptr = 0;

	let end = outptr + (length >> 1);	// W16

	do {
		let value = source[inptr++];
		if (value != rlewtag) {

			// uncompressed
			dest[outptr++] = value;
		}
		else {

			// compressed string
			let count = source[inptr++];
			value = source[inptr++];

			for (let i=1;i<=count;++i) {
				dest[outptr++] = value;
			}
		}
	}
	while (outptr < end);

	return dest;
}



function Carmack_Expand(source, length) {

	const NEARTAG = 0xA7;
	const FARTAG  = 0xA8;

	let chhigh, offset;		/* W32 */
	let copyptr, outptr;	/* W16 */
	let inptr;				/* W8 */
	let ch, count;			/* W16 */
	let dest;

	length /= 2;

	inptr = 0;
	outptr = 0;
	dest = [];

	function W16(b, i) { return b[i] + (b[i+1] << 8); }

	while (length) {

		ch = source[inptr] + (source[inptr+1] << 8);
		//ch = W16(source, inptr);
		inptr += 2;
		chhigh = ch >> 8;
		if (chhigh == NEARTAG) {

			count = ch & 0xff;
			if (!count) {

				// have to insert a word containing the tag byte
				ch |= source[inptr++];
				dest[outptr++] = ch;
				length--;
			}
			else {

				offset = source[inptr++];
				copyptr = outptr - offset;
				length -= count;
				while (count--) {
					dest[outptr++] = dest[copyptr++];
				}
			}
		}
		else if (chhigh == FARTAG) {

			count = ch & 0xff;
			if (!count) {

				// have to insert a word containing the tag byte
				ch |= source[inptr++];
				dest[outptr++] = ch;
				length--;
			}
			else {

				offset = source[inptr] + (source[inptr+1] << 8);
				//offset = W16(source, inptr);
				inptr += 2;
				copyptr = offset;
				length -= count;
				while (count--) {
					dest[outptr++] = dest[copyptr++];
				}
			}
		}
		else {
			dest[outptr++] = ch;
			length--;
		}
	}

	return dest;
}



function Huffman_Create(data) {

	const dict = [];

	for(let i=0; i<data.length; i++) {
		dict.push({ bit0: data[i][0], bit1: data[i][1] });
	}

	return dict;
}


function Huffman_Expand(data_enc, data_len, hufftable) {

	const data_dec = new Uint8Array(data_len);
	let dec_idx = 0;

	let headptr = hufftable[254];	// head node is always node 254
	let huffptr = headptr;

	let enc_idx = 0;
	let val = data_enc[enc_idx];
	enc_idx++;

	let mask = 1;
	let nodeval = 0;

	while(enc_idx < data_enc.length)	{
		if(!(val & mask)) {
			nodeval = huffptr.bit0;
		}
		else {
			nodeval = huffptr.bit1;
		}

		// 0x80
		if(mask === 128) {
			val = data_enc[enc_idx];
			enc_idx++;
			mask = 1;
		}
		else {
			mask <<= 1;
		}

		if(nodeval < 256) {
			data_dec[dec_idx] = nodeval;
			huffptr = headptr;
			dec_idx++;
			if(dec_idx >= data_len) break;
		}
		else {
			huffptr = hufftable[nodeval - 256];
		}
	}

	return data_dec;
}



async function Fetch_Buffer(filename) {

	try {
		let response = await fetch(filename);
		let buffer = await response.arrayBuffer();
		return buffer;
	}
	catch(error) { console.log(error.message); };
}


