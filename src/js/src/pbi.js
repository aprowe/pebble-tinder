function convertImage(rgbaPixels, numComponents, width, height){
	// var grey_pixels = greyScale(rgbaPixels, width, height, numComponents);
	// var pixel6 = BitColor(rgbaPixels, width, height, numComponents);
	var colors = splitColors(rgbaPixels, numComponents);
	var SIZE = 135;

	var r = ScaleRect(colors[0], width, height, SIZE, SIZE);
	var g = ScaleRect(colors[1], width, height, SIZE, SIZE);
	var b = ScaleRect(colors[2], width, height, SIZE, SIZE);

	floydSteinberg(r, SIZE, SIZE);
	floydSteinberg(g, SIZE, SIZE);
	floydSteinberg(b, SIZE, SIZE);

	var final_pixels = combineTo6Bit(r, g, b);
	return final_pixels;
}

function splitColors(rgba, numComponents) {
	var colors = [];

	for(var i = 0; i < numComponents; i++) {
		colors[i] = [];
	}
	for(var i = 0; i < rgba.length; i++) {
		colors[i % numComponents].push(rgba[i]);
	}

	return colors;
}

function combineTo6Bit(rArray, gArray, bArray) {
	var pixels = [];

	for (var i = 0; i < rArray.length; i++) {
		var r = Math.floor(rArray[i] * 3 / 255);
		var g = Math.floor(gArray[i] * 3 / 255);
		var b = Math.floor(bArray[i] * 3 / 255);

		var color = (r << 4) + (g << 2) + (b << 0);
		pixels.push(color);
	}

	return pixels;
}


/**
 * Credits : Damian Mehers : http://blog.evernote.com/tech/2014/04/23/evernote-pebble-update/#bitmaps
 */
function convertToPebbleBitmap(bw_input, width, height) {
	// Calculate the number of bytes per row, one bit per pixel, padded to 4 bytes
	var rowSizePaddedWords = Math.floor((width + 31) / 32);
	var widthBytes = rowSizePaddedWords * 4;

	var flags = 1 << 12;             // The version number is at bit 12.  Version is 1
	var result = [];                 // Array of bytes that we produce
	pushUInt16(result, widthBytes);  // row_size_bytes
	pushUInt16(result, flags);       // info_flags
	pushUInt16(result, 0);           // bounds.origin.x
	pushUInt16(result, 0);           // bounds.origin.y
	pushUInt16(result, width);       // bounds.size.w
	pushUInt16(result, height);      // bounds.size.h

	var currentInt = 0;
	for(var y = 0; y < height; y++){
		var bit = 0;
		currentInt = 0;
		for(var x = 0; x < width; x++){
			var color = bw_input[y * width + x];
			if (color == 255) { // black pixel
				currentInt |= (1 << bit);
			}
			bit += 1;
			if (bit == 32) {
				bit = 0;
				pushUInt32(result, currentInt);
				currentInt = 0;
			}
		}
		if (bit > 0) {
			pushUInt32(result, currentInt);
		}
	}

	return result;
}

function pushUInt16(array, value) {
	array.push(value >> 0 & 0xFF);
	array.push(value >> 8 & 0xFF);
}

function pushUInt32(array, value) {
	array.push(value >> 0 & 0xFF);
	array.push(value >> 8 & 0xFF);
	array.push(value >> 16 & 0xFF);
	array.push(value >> 24 & 0xFF);
}
