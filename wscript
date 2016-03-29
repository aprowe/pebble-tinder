#
# This file is the default set of rules to compile a Pebble project.
#
# Feel free to customize this to your needs.
#

import os.path
import os
import json
import shutil
from sh import uglifyjs

top = '.'
out = 'build'


def options(ctx):
    ctx.load('pebble_sdk')

def distclean(ctx):
    ctx.load('pebble_sdk')
    for p in ['build', 'src/generated', 'src/js/src/generated', 'src/js/pebble-js-app.js']:
        try:
            if os.path.isfile(p): os.remove(p)
            elif os.path.isdir(p): shutil.rmtree(p)
        except OSError as e:
            pass

def configure(ctx):
    """
    This method is used to configure your build.
    ctx.load(`pebble_sdk`) automatically configures a build for each valid platform in `targetPlatforms`.
    Platform-specific configuration: add your change after calling ctx.load('pebble_sdk') and make sure to set the
    correct environment first.
    Universal configuration: add your change prior to calling ctx.load('pebble_sdk').
    """
    ctx.load('pebble_sdk')


def build(ctx):
    ctx.load('pebble_sdk')


    build_worker = os.path.exists('worker_src')
    binaries = []

    for p in ctx.env.TARGET_PLATFORMS:
        ctx.set_env(ctx.all_envs[p])
        ctx.set_group(ctx.env.PLATFORM_NAME)
        app_elf = '{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
        ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'), target=app_elf)

    	# Run jshint on appinfo.json
    	# ctx(rule=js_jshint, source='appinfo.json')

    	# Run jshint on all the JavaScript files
    	# ctx(rule=js_jshint, source=ctx.path.ant_glob('src/js/src/**/*.js'))

    	# Generate appinfo.h
    	ctx(rule=generate_appinfo_h, source='appinfo.json', target='../src/generated/appinfo.h')

    	# Generate keys.h
    	ctx(rule=generate_keys_h, source='src/keys.json', target='../src/generated/keys.h')

    	# Generate appinfo.js
    	ctx(rule=generate_appinfo_js, source='appinfo.json', target='../src/js/src/generated/appinfo.js')

    	# Generate keys.js
    	ctx(rule=generate_keys_js, source='src/keys.json', target='../src/js/src/generated/keys.js')

    	# Combine the source JS files into a single JS file.
    	ctx(rule=concatenate_js, source=ctx.path.ant_glob('src/js/src/**/*.js'), target='../src/js/pebble-js-app.js')


        if build_worker:
            worker_elf = '{}/pebble-worker.elf'.format(ctx.env.BUILD_DIR)
            binaries.append({'platform': p, 'app_elf': app_elf, 'worker_elf': worker_elf})
            ctx.pbl_worker(source=ctx.path.ant_glob('worker_src/**/*.c'), target=worker_elf)
        else:
            binaries.append({'platform': p, 'app_elf': app_elf})

    ctx.set_group('bundle')
    ctx.pbl_bundle(binaries=binaries, js=ctx.path.ant_glob(['src/js/**/*.js', 'src/js/**/*.json']), js_entry_file='src/js/app.js')

def generate_appinfo_h(task):
	src = task.inputs[0].abspath()
	target = task.outputs[0].abspath()
	appinfo = json.load(open(src))
	f = open(target, 'w')
	f.write('#pragma once\n\n')
	f.write('#define VERSION_LABEL "{0}"\n'.format(appinfo['versionLabel']))
	f.write('#define UUID "{0}"\n'.format(appinfo['uuid']))
	for key in appinfo['appKeys']:
		f.write('#define APP_KEY_{0} {1}\n'.format(key.upper(), appinfo['appKeys'][key]))
	f.close()

def generate_keys_h(task):
	src = task.inputs[0].abspath()
	target = task.outputs[0].abspath()
	keys = json.load(open(src))
	f = open(target, 'w')
	f.write('#pragma once\n\n')
	for key in keys:
		f.write('enum {\n')
		for key2 in keys[key]:
			f.write('\tKEY_{0}_{1},\n'.format(key, key2))
		f.write('};\n')
	f.close()

def generate_appinfo_js(task):
	src = task.inputs[0].abspath()
	target = task.outputs[0].abspath()
	data = open(src).read().strip()
	f = open(target, 'w')
	f.write('var AppInfo = ')
	f.write(data)
	f.write(';')
	f.close()

def generate_keys_js(task):
	src = task.inputs[0].abspath()
	target = task.outputs[0].abspath()
	keys = json.load(open(src))
	f = open(target, 'w')
	for key in keys:
		f.write('var {0} = {{'.format(key))
		i = 0
		for key2 in keys[key]:
			if i > 0: f.write(',')
			f.write('\n\t{0}: {1}'.format(key2, i))
			i += 1
		f.write('\n};\n')
	f.close()

def concatenate_js(task):
	inputs = (input.abspath() for input in task.inputs)
	uglifyjs(*inputs, o=task.outputs[0].abspath(), b=True)

def js_jshint(task):
	inputs = (input.abspath() for input in task.inputs)
	jshint(*inputs)
