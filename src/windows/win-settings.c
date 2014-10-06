#include <pebble.h>
#include "win-settings.h"
#include "libs/pebble-assist.h"
#include "tinder.h"

static void window_load(Window *window);
static void window_unload(Window *window);

static Window* window = NULL;

void win_settings_init(void) {
	window = window_create();
	window_set_fullscreen(window, true);
	window_set_background_color(window, GColorBlack);
	window_set_window_handlers(window, (WindowHandlers) {
		.load = window_load,
		.unload = window_unload,
	});
}

void win_settings_push(void) {
	window_stack_push(window, true);
}

void win_settings_deinit(void) {
	window_destroy_safe(window);
}

void win_settings_reload_data_and_mark_dirty(void) {
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - //

static void window_load(Window *window) {
}

static void window_unload(Window *window) {
}
