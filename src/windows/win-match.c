#include <pebble.h>
#include "win-match.h"
#include "libs/pebble-assist.h"
#include "tinder.h"

static void select_single_click_handler(ClickRecognizerRef recognizer, void *context);
static void click_config_provider(void *context);
static void window_load(Window *window);
static void window_unload(Window *window);

static Window* window = NULL;
static GBitmap* like_bitmap = NULL;
static BitmapLayer* like_bitmap_layer = NULL;
static TextLayer* text_layer;

void win_match_init(void) {
	like_bitmap = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_LIKE);

	window = window_create();
	// window_set_fullscreen(window, true);
	window_set_background_color(window, GColorWhite);
	window_set_click_config_provider(window, click_config_provider);
	window_set_window_handlers(window, (WindowHandlers) {
		.load = window_load,
		.unload = window_unload,
	});
}

void win_match_push(void) {
	if (window && window_stack_contains_window(window)) {
		return;
	}
	window_stack_push(window, true);
}

void win_match_deinit(void) {
	gbitmap_destroy_safe(like_bitmap);
	window_destroy_safe(window);
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - //

static void select_single_click_handler(ClickRecognizerRef recognizer, void *context) {
	window_stack_pop(true);
	tinder_request_rec();
}

static void click_config_provider(void *context) {
	window_single_click_subscribe(BUTTON_ID_SELECT, select_single_click_handler);
	window_single_click_subscribe(BUTTON_ID_BACK, select_single_click_handler);
}

static void window_load(Window *window) {
	// like_bitmap_layer = bitmap_layer_create(GRect(61, 60, 21, 19));
	// bitmap_layer_set_bitmap(like_bitmap_layer, like_bitmap);
	// // bitmap_layer_set_compositing_mode(like_bitmap_layer, GCompOpAssignInverted);
	// bitmap_layer_add_to_window(like_bitmap_layer, window);

	text_layer = text_layer_create(GRect(4, 20, 136, 30));
	text_layer_set_system_font(text_layer, FONT_KEY_BITHAM_30_BLACK);
	text_layer_set_text(text_layer, "Match!");
	text_layer_set_text_alignment(text_layer, GTextAlignmentCenter);
	text_layer_set_colors(text_layer, GColorFolly, GColorClear);
	text_layer_add_to_window(text_layer, window);
}

static void window_unload(Window *window) {
	text_layer_destroy_safe(text_layer);
	bitmap_layer_destroy_safe(like_bitmap_layer);
}
