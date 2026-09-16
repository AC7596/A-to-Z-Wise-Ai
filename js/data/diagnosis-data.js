// ========================================
// AI DIAGNOSIS KNOWLEDGE BASE (front-end demo)
// ========================================
// This is a rule-based, keyword-matching stand-in for a real AI model.
// It intentionally mirrors the shape of a response a real AI diagnosis
// backend would return, so swapping in a live API later (see
// js/api/ai-client.js) requires no changes to the rendering code.
//
// Each issue entry can include:
//   causes            - most likely causes (shown first)
//   otherCauses       - other possible causes, less common
//   clarifyingQuestions - questions that would help narrow the diagnosis
//   nextCheck         - what the homeowner should check next
//   steps             - step-by-step troubleshooting
//   tools             - tools that may be needed
//   parts             - parts/materials that may be needed
//   time              - estimated repair time
//   difficulty        - a slug from js/data/levels.js
//   tips              - helpful tips
//   stopWhen          - conditions under which the homeowner should stop
//   pro               - when/why to call a qualified professional
//   safety            - short safety note shown in the summary grid

import { LEVELS } from './levels.js';

export const diagnosisDatabase = {
  plumbing: {
    dangers: {
      keywords: ['gas', 'line', 'main break', 'flooding', 'raw sewage', 'sewer'],
      message: 'This plumbing issue may involve your main water line, sewage system, or serious water damage.',
      badge: 'Call Licensed Plumber'
    },
    issues: {
      'drip|leak|water': {
        causes: ['Worn faucet seals', 'Loose connection', 'Corroded pipe'],
        otherCauses: ['Cracked valve body', 'High water pressure stressing fittings'],
        clarifyingQuestions: ['Is the leak constant or only when water is running?', 'Is the water visibly discolored or rusty?'],
        nextCheck: 'Turn off water supply; locate exact source of leak',
        steps: [
          'Turn off the water supply valve under the fixture.',
          'Dry the area completely and watch where water reappears first.',
          'Check visible connections and washers for wear or looseness.',
          'Tighten loose fittings by hand before considering part replacement.'
        ],
        tools: ['Adjustable wrench', 'Flashlight', 'Towels'],
        parts: ['Replacement washer or O-ring', 'Plumber\'s tape'],
        time: '20–45 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: ['Take a photo of the fitting before removing it so reassembly is easier.'],
        stopWhen: 'Water is spraying forcefully or you cannot identify the shutoff valve.',
        safety: 'Turn off water supply first',
        pro: 'If water is spraying, shut off the main water valve immediately and call a plumber.',
        relatedGuideId: 'dripping-faucet'
      },
      'slow drain|draining slowly|drain slow': {
        causes: ['Partial drain blockage', 'Hair and soap buildup', 'Vent pipe issue'],
        otherCauses: ['Grease buildup in the trap', 'Tree roots in older drain lines'],
        clarifyingQuestions: ['Is only one drain slow, or several at once?', 'Does it gurgle when other fixtures are used?'],
        nextCheck: 'Check drain for visible debris; pour hot water or use plunger',
        steps: [
          'Remove and clean any visible drain stopper or strainer.',
          'Try a cup plunger with some water in the basin for suction.',
          'Use a drain snake for buildup you cannot reach by hand.',
          'Flush with hot water to clear soap or grease residue.'
        ],
        tools: ['Cup plunger', 'Drain snake', 'Gloves'],
        parts: ['Drain cleaner (enzyme-based, optional)'],
        time: '15–30 minutes',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: ['Avoid chemical drain cleaners repeatedly — they can damage older pipes.'],
        stopWhen: 'Multiple drains are slow at the same time, which can mean a main line issue.',
        safety: 'Use normal precautions',
        pro: 'For clogs that don\'t respond to plunging, a professional snake or hydro-jet can clear it.'
      },
      'gurgling|backing up|overflow': {
        causes: ['Blocked drain line', 'Vent stack blockage', 'Septic system issue'],
        otherCauses: ['Main sewer line clog', 'Collapsed or damaged pipe section'],
        clarifyingQuestions: ['Does water back up into other fixtures (like the tub) when you flush?', 'Have you noticed slow drains elsewhere in the house recently?'],
        nextCheck: 'Check all drains in the house; listen for air sounds',
        steps: [
          'Check whether the problem happens at one drain or several.',
          'Avoid running more water until the cause is identified.',
          'Look outside for a cleanout cap and check if it is overflowing.'
        ],
        tools: ['Flashlight'],
        parts: [],
        time: 'Inspection only — repair time varies',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'Sewage odor, backup into tubs/showers, or water on the floor — stop use immediately.',
        safety: 'Do not use if sewage is backing up',
        pro: 'Backup can indicate a main line clog — call a professional plumber immediately.'
      },
      'no water|low pressure': {
        causes: ['Shut-off valve closed', 'Supply line freeze or break', 'Municipal water issue'],
        otherCauses: ['Clogged aerator or cartridge', 'Pressure regulator failure'],
        clarifyingQuestions: ['Is it affecting the whole house or one fixture?', 'Has it been very cold recently?'],
        nextCheck: 'Check the main shutoff valve; verify neighbors have water',
        steps: [
          'Confirm the main shutoff valve is fully open.',
          'Check a single fixture aerator for mineral buildup.',
          'Ask neighbors or check your utility for area outages.'
        ],
        tools: ['Adjustable wrench'],
        parts: ['Replacement aerator'],
        time: '10–30 minutes',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: [],
        stopWhen: 'You suspect a frozen or burst pipe inside a wall.',
        safety: 'Do not damage pipes while searching',
        pro: 'If the issue is inside your walls, a plumber can locate and repair it.'
      },
      'toilet': {
        causes: ['Flapper valve worn', 'Fill valve failure', 'Bowl crack'],
        otherCauses: ['Chain misadjustment', 'Mineral buildup in the fill valve'],
        clarifyingQuestions: ['Does it run constantly or only intermittently?', 'Do you hear hissing after each flush?'],
        nextCheck: 'Check if it runs constantly; listen for hissing sounds',
        steps: [
          'Remove the tank lid and watch the flapper during a flush.',
          'Check the chain length between the flapper and the flush lever.',
          'Inspect the fill valve for continuous water flow.'
        ],
        tools: ['None required for inspection'],
        parts: ['Flapper valve', 'Fill valve kit'],
        time: '20–40 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: ['Toilet repair kits are inexpensive and come with clear instructions.'],
        stopWhen: 'You see a crack in the porcelain bowl or tank.',
        safety: 'Low risk',
        pro: 'Internal toilet parts are inexpensive and easy to replace with guidance.'
      }
    }
  },
  electrical: {
    dangers: {
      keywords: ['spark', 'shock', 'burn', 'fire', 'breaker trip', 'electric', 'outlet', 'switch', 'wire'],
      message: 'Electrical problems can be serious. Many require a licensed electrician for safety.',
      badge: 'Call Licensed Electrician'
    },
    issues: {
      'outlet|socket': {
        causes: ['Tripped circuit breaker', 'Loose connection', 'Failed outlet'],
        otherCauses: ['Tripped GFCI elsewhere on the circuit', 'Worn internal contacts'],
        clarifyingQuestions: ['Are other outlets nearby also affected?', 'Is there a GFCI outlet upstream on the same circuit?'],
        nextCheck: 'Check circuit breaker; test outlet with a lamp',
        steps: [
          'Check the breaker panel for a tripped breaker.',
          'Look for and reset any GFCI outlets on the same circuit.',
          'Test the outlet with a known-working lamp or device.'
        ],
        tools: ['None required for inspection'],
        parts: [],
        time: '10–20 minutes for inspection',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'You see scorch marks, smell burning, or the outlet is warm to the touch.',
        safety: 'Do not attempt to repair outlets yourself',
        pro: 'Electrical outlets should only be replaced by a qualified electrician.'
      },
      'switch': {
        causes: ['Bad switch', 'Blown bulb', 'Tripped breaker'],
        otherCauses: ['Loose wire connection at the switch', 'Failed light fixture'],
        clarifyingQuestions: ['Does the switch feel loose or make noise when flipped?', 'Have you tried a different bulb?'],
        nextCheck: 'Try a different bulb; check breaker panel',
        steps: [
          'Replace the bulb with one you know works.',
          'Check the breaker panel for a tripped breaker.',
          'Note whether the switch feels loose or unusually warm.'
        ],
        tools: [],
        parts: ['Replacement bulb'],
        time: '10–15 minutes for inspection',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'The switch is warm, sparks, or makes a buzzing sound.',
        safety: 'Never open a switch box',
        pro: 'Hire a licensed electrician for any switch or wiring work.'
      },
      'breaker|trip': {
        causes: ['Overloaded circuit', 'Short circuit', 'Faulty appliance'],
        otherCauses: ['Loose neutral connection', 'Aging breaker that needs replacement'],
        clarifyingQuestions: ['Does it trip immediately or after running for a while?', 'Is one specific appliance always plugged in when it trips?'],
        nextCheck: 'Unplug devices; reset breaker one at a time',
        steps: [
          'Unplug all devices on the affected circuit.',
          'Reset the breaker.',
          'Plug devices back in one at a time to identify the culprit.'
        ],
        tools: [],
        parts: [],
        time: '15–30 minutes for inspection',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'The breaker trips repeatedly even with everything unplugged.',
        safety: 'Do not repeatedly reset a tripping breaker',
        pro: 'Repeated breaker trips indicate an electrical fault — call an electrician.',
        relatedGuideId: 'gfci-outlet-tripped'
      },
      'shock|tingling': {
        causes: ['Damaged appliance', 'Wet condition', 'Faulty wiring'],
        otherCauses: ['Missing ground connection', 'Damaged appliance cord'],
        clarifyingQuestions: [],
        nextCheck: 'Stop immediately; unplug the device',
        steps: [
          'Stop using the device or outlet immediately.',
          'Unplug it if it is safe to reach the plug without contact risk.',
          'Do not touch it again until an electrician has inspected it.'
        ],
        tools: [],
        parts: [],
        time: 'Do not attempt repair',
        difficulty: LEVELS.EMERGENCY.slug,
        tips: [],
        stopWhen: 'Immediately — this is a shock hazard.',
        safety: 'Critical danger',
        pro: 'Call an electrician immediately. Do not use the appliance again.'
      },
      'spark|fire|smoke': {
        causes: ['Electrical arc', 'Overheating wire', 'Component failure'],
        otherCauses: [],
        clarifyingQuestions: [],
        nextCheck: 'Turn off power; evacuate if necessary',
        steps: [
          'Turn off power at the breaker if it is safe to reach.',
          'Evacuate the area if you see flame or heavy smoke.',
          'Call 911 or your local emergency number.'
        ],
        tools: [],
        parts: [],
        time: 'Emergency — do not attempt repair',
        difficulty: LEVELS.EMERGENCY.slug,
        tips: [],
        stopWhen: 'Immediately.',
        safety: 'Life-threatening danger',
        pro: 'Call 911 or your emergency services first. Do not touch.'
      }
    }
  },
  appliance: {
    dangers: {
      keywords: ['gas', 'pilot', 'leak', 'fire', 'overheat', 'mold', 'electric'],
      message: 'Some appliance issues may involve gas, electrical, or thermal hazards.',
      badge: 'Consult Professional'
    },
    issues: {
      'refrigerator|fridge': {
        causes: ['Compressor issue', 'Thermostat failure', 'Dirty condenser coils'],
        otherCauses: ['Door seal not sealing properly', 'Blocked air vents inside the fridge'],
        clarifyingQuestions: ['Is the compressor humming, or completely silent?', 'When were the coils last cleaned?'],
        nextCheck: 'Check if it\'s running; listen for compressor sound; clean coils',
        steps: [
          'Unplug the fridge before cleaning.',
          'Vacuum the condenser coils (usually rear or underneath).',
          'Check the door gasket for gaps or debris.',
          'Plug back in and monitor temperature over a few hours.'
        ],
        tools: ['Vacuum with brush attachment', 'Flashlight'],
        parts: ['Door gasket (if worn)'],
        time: '30–60 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: ['Clean coils every 6 months to prevent this from recurring.'],
        stopWhen: 'You smell a chemical or ammonia-like odor.',
        safety: 'Unplug before cleaning',
        pro: 'Compressor or refrigerant issues need a technician.',
        relatedGuideId: 'refrigerator-not-cooling'
      },
      'washer|washing machine': {
        causes: ['Clogged drain', 'Water inlet valve', 'Drive belt wear'],
        otherCauses: ['Unbalanced load triggering a safety stop', 'Failing lid or door switch'],
        clarifyingQuestions: ['Does it stop at a specific point in the cycle?', 'Is there unusual noise before it stops?'],
        nextCheck: 'Check drain hose; run a test cycle',
        steps: [
          'Unplug the washer before inspecting.',
          'Check the drain hose for kinks or clogs.',
          'Run an empty test cycle to observe behavior.'
        ],
        tools: ['Pliers'],
        parts: ['Drive belt (if worn)'],
        time: '30–60 minutes',
        difficulty: LEVELS.INTERMEDIATE.slug,
        tips: [],
        stopWhen: 'You see water leaking near electrical components.',
        safety: 'Unplug before working on it',
        pro: 'Internal drum or motor issues require a technician.'
      },
      // Dryer: the same base entry backs two genuinely different problems —
      // "runs but no heat" and "won't start at all". `subIssues` let the
      // session-fact layer (js/data/fact-data.js) pick the right one from
      // what the homeowner has ALREADY said instead of asking again.
      // A sub-issue with `when` only matches once every referenced fact is
      // known; a sub-issue with `notWhen` is excluded once those facts are
      // known. While nothing is known either way, `defaultSubIssue` is used
      // and its clarifying questions are what establish the missing facts.
      'dryer': {
        subIssues: {
          'no-heat': {
            when: { all: { runs: true, heats: false } },
            notWhen: { any: { runs: false, heats: true } },
            causes: [
              'Clogged or restricted exhaust vent',
              'Thermal fuse blown',
              'High-limit thermostat or thermal cutoff tripped',
              { text: 'Heating element burned out', when: { all: { powerType: 'electric' } } },
              { text: 'Only one leg of the 240V supply reaching the dryer (partial tripped breaker)', when: { all: { powerType: 'electric' } } },
              { text: 'Gas igniter or gas valve solenoid failure', when: { all: { powerType: 'gas' } } },
              'Lint trap full / airflow restriction'
            ],
            otherCauses: [
              'Faulty cycling thermostat',
              { text: 'Worn or broken drive belt', notWhen: { all: { drumTurns: true } } },
              { text: 'Faulty door switch', notWhen: { all: { runs: true } } },
              { text: 'Failed timer or electronic control board', notWhen: { all: { drumTurns: true, powerType: 'electric' } } }
            ],
            clarifyingQuestions: [
              { text: 'Is the dryer gas or electric?', when: { not: { powerType: ['gas', 'electric'] } } },
              { text: 'Does the drum turn normally when it runs?', when: { not: { drumTurns: [true, false] } } },
              'Is there absolutely no heat, or does it get slightly warm?',
              { text: 'Has drying time gradually increased over the past weeks or months?', when: { negated: 'slowProgress' } },
              'Is the airflow from the outside vent weak while it runs?',
              'When was the vent last cleaned?'
            ],
            nextCheck: 'Clean lint trap; check exhaust vent for blockage and weak outside airflow',
            steps: [
              'Unplug the dryer (and shut off the gas supply valve for a gas dryer).',
              'Clean the lint trap thoroughly.',
              'Disconnect and check the exhaust vent hose for lint buildup.',
              'Check the airflow at the exterior vent hood while the dryer runs.',
              'Reconnect and test a short cycle on high heat.'
            ],
            tools: ['Vent brush', 'Screwdriver', 'Multimeter (optional, for element/fuse testing)'],
            parts: ['Thermal fuse (if blown)', 'Heating element (electric, if failed)'],
            time: '30–45 minutes',
            difficulty: LEVELS.BEGINNER.slug,
            tips: ['A clogged vent is a common fire risk — clean it at least once a year.'],
            stopWhen: 'You notice a burning smell.',
            safety: 'Unplug first',
            pro: 'Heating element, gas valve, or control-board failure needs a professional.'
          },
          'no-start': {
            when: { all: { runs: false } },
            causes: [
              'No power — tripped breaker, blown fuse, or loose plug',
              'Faulty door switch',
              'Failed start switch',
              'Thermal fuse blown (cuts power to the whole dryer on many models)'
            ],
            otherCauses: [
              'Worn drive belt (on models with a broken-belt kill switch)',
              'Failed drive motor',
              'Failed timer or electronic control board'
            ],
            clarifyingQuestions: [
              'Do any lights or sounds come on when you try to start it?',
              'Does the door click firmly shut?',
              'Have you checked the breaker or tried another outlet?'
            ],
            nextCheck: 'Confirm the outlet has power; check the breaker and door switch',
            steps: [
              'Confirm the dryer is plugged in fully (240V plugs can work loose).',
              'Check the breaker panel for a tripped breaker and reset it once.',
              'Open and firmly re-close the door, listening for the door-switch click.',
              'If it is completely dead, test the outlet with another device or a multimeter.'
            ],
            tools: ['Multimeter (optional)', 'Screwdriver'],
            parts: ['Door switch (if failed)', 'Thermal fuse (if blown)'],
            time: '20–45 minutes',
            difficulty: LEVELS.BEGINNER.slug,
            tips: ['A dryer that stopped mid-cycle and now won\'t start often has a blown thermal fuse from a clogged vent.'],
            stopWhen: 'You see scorch marks, smell burning, or find damaged wiring.',
            safety: 'Unplug first',
            pro: 'Motor or control-board replacement needs a professional.'
          }
        },
        // Used while the session facts don't yet say whether the dryer
        // runs — the questions here are exactly what establish that.
        defaultSubIssue: 'no-heat',
        causes: ['Clogged or restricted exhaust vent', 'Thermal fuse blown', 'High-limit thermostat or thermal cutoff tripped'],
        otherCauses: ['Faulty door switch (if it will not start)', 'Worn drive belt (if the drum does not turn)'],
        clarifyingQuestions: ['Does it run but not produce heat, or not run at all?', 'Is the dryer gas or electric?', 'When was the vent last cleaned?'],
        nextCheck: 'Note whether it runs at all; clean lint trap; check exhaust vent for blockage',
        steps: [
          'Unplug the dryer.',
          'Clean the lint trap thoroughly.',
          'Disconnect and check the exhaust vent hose for lint buildup.',
          'Reconnect and test a short cycle.'
        ],
        tools: ['Vent brush', 'Screwdriver'],
        parts: ['Thermal fuse (if blown)'],
        time: '30–45 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: ['A clogged vent is a common fire risk — clean it at least once a year.'],
        stopWhen: 'You notice a burning smell.',
        safety: 'Unplug first',
        pro: 'Heating element or motor failure needs a professional.'
      },
      'dishwasher': {
        causes: ['Drain clogged', 'Spray arm blocked', 'Inlet valve stuck'],
        otherCauses: ['Failed float switch', 'Worn door seal causing leaks'],
        clarifyingQuestions: ['Is water pooling at the bottom after a cycle?', 'Are dishes coming out with residue or not fully clean?'],
        nextCheck: 'Check drain; inspect spray arm holes',
        steps: [
          'Unplug or turn off the dishwasher.',
          'Remove and clean the filter and spray arm holes.',
          'Check the drain hose for kinks.'
        ],
        tools: ['Soft brush'],
        parts: [],
        time: '20–40 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: [],
        stopWhen: 'Water is leaking onto the floor near outlets.',
        safety: 'Unplug first',
        pro: 'Pump or motor replacement requires a technician.'
      },
      'microwave': {
        causes: ['Door latch broken', 'Keypad malfunction', 'Magnetron failure'],
        otherCauses: ['Blown fuse', 'Faulty door switch'],
        clarifyingQuestions: [],
        nextCheck: 'Check if it powers on; test keypad',
        steps: [
          'Confirm the door latches fully and securely.',
          'Check that the outlet is providing power.',
          'Do not open the casing yourself.'
        ],
        tools: [],
        parts: [],
        time: 'Inspection only',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'Always avoid opening the case — it stores high voltage even when unplugged.',
        safety: 'Do not open—contains high-voltage components',
        pro: 'Most microwave repairs require a technician.'
      },
      'oven|stove|range': {
        causes: [
          { text: 'Burner element failure (electric)', when: { unknownOr: { powerType: 'electric' } } },
          { text: 'Igniter failure (gas)', when: { unknownOr: { powerType: 'gas' } } },
          'Thermostat issue'
        ],
        otherCauses: [
          'Faulty temperature sensor',
          { text: 'Gas supply issue', when: { all: { powerType: 'gas' } } }
        ],
        clarifyingQuestions: [
          { text: 'Is this gas or electric?', when: { not: { powerType: ['gas', 'electric'] } } },
          'Does it click but not ignite, or not respond at all?'
        ],
        nextCheck: 'Check if burners ignite; test temperature control',
        steps: [
          'Turn off the appliance and let it cool.',
          'Check for visible damage to the burner or igniter.',
          'For electric coil burners, check for a swap-test with a known-good burner.'
        ],
        tools: ['None required for inspection'],
        parts: ['Burner element or igniter'],
        time: '20–60 minutes',
        difficulty: LEVELS.INTERMEDIATE.slug,
        tips: [],
        stopWhen: 'You smell gas at any point.',
        safety: 'Turn off gas or power; let cool',
        pro: 'Gas line or heating element issues need a professional.'
      }
    }
  },
  'heating & cooling': {
    dangers: {
      keywords: ['carbon monoxide', 'gas', 'furnace', 'fire', 'refrigerant'],
      message: 'Heating and cooling issues can involve gas, carbon monoxide, or electrical hazards.',
      badge: 'Consult HVAC Professional'
    },
    issues: {
      'not heating|no heat|cold': {
        causes: ['Thermostat set low', 'Pilot light out', 'Furnace power off', 'Blocked air intake'],
        otherCauses: ['Dirty flame sensor', 'Tripped safety switch'],
        clarifyingQuestions: ['Does the thermostat display turn on at all?', 'Do you hear the furnace attempting to start?'],
        nextCheck: 'Check thermostat setting; verify furnace is on; check for error lights',
        steps: [
          'Confirm the thermostat is set to heat and above room temperature.',
          'Check that the furnace switch and breaker are on.',
          'Look for blinking error codes on the furnace control board.',
          'Replace the air filter if it is dirty.'
        ],
        tools: ['Flashlight'],
        parts: ['Air filter'],
        time: '15–30 minutes',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: [],
        stopWhen: 'The furnace repeatedly shuts off or you smell gas.',
        safety: 'Let furnace rest if it shuts off repeatedly',
        pro: 'If pilot won\'t light or furnace keeps shutting off, call HVAC immediately.',
        relatedGuideId: 'room-not-heating'
      },
      'not cooling|no ac|hot room': {
        causes: ['Thermostat setting', 'Clogged air filter', 'Outdoor unit issue', 'Low refrigerant'],
        otherCauses: ['Frozen evaporator coil', 'Tripped disconnect switch at the outdoor unit'],
        clarifyingQuestions: ['Is the outdoor condenser fan spinning?', 'Is there ice visible on any indoor lines?'],
        nextCheck: 'Check thermostat; change air filter; verify outdoor condenser is running',
        steps: [
          'Set thermostat well below room temperature and confirm it calls for cooling.',
          'Replace a dirty air filter.',
          'Check that the outdoor unit fan is spinning and clear of debris.'
        ],
        tools: [],
        parts: ['Air filter'],
        time: '15–30 minutes',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: [],
        stopWhen: 'You see ice buildup on refrigerant lines.',
        safety: 'Do not handle refrigerant',
        pro: 'Low refrigerant or compressor problems require an HVAC professional.'
      },
      'filter': {
        causes: ['Dirty filter restricting airflow'],
        otherCauses: [],
        clarifyingQuestions: [],
        nextCheck: 'Replace air filter monthly during heavy use',
        steps: ['Turn off the system.', 'Remove the old filter and note the size printed on the frame.', 'Insert the new filter with airflow arrows pointing the correct direction.'],
        tools: [],
        parts: ['Air filter (correct size)'],
        time: '5–10 minutes',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: ['Set a monthly reminder to check the filter.'],
        stopWhen: '',
        safety: 'Turn off system before changing',
        pro: 'If problems persist after filter change, call HVAC.'
      },
      'noise|loud|rattling': {
        causes: ['Loose ductwork', 'Blower issue', 'Debris in unit'],
        otherCauses: ['Loose panel screws', 'Worn blower bearing'],
        clarifyingQuestions: ['Is the noise from indoors, outdoors, or both?', 'Does it happen at startup, shutdown, or continuously?'],
        nextCheck: 'Check for loose ducts; inspect around outdoor unit',
        steps: ['Check accessible ductwork for loose sections.', 'Clear leaves or debris from the outdoor unit.', 'Tighten visible access panel screws.'],
        tools: ['Screwdriver'],
        parts: [],
        time: '15–30 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: [],
        stopWhen: 'The noise is a grinding or screeching metal sound.',
        safety: 'Do not open sealed units',
        pro: 'Unusual noises often indicate mechanical problems — call HVAC.'
      },
      'smell|odor': {
        causes: ['Musty smell: mold in ducts or evaporator', 'Burning smell: furnace startup or clogged filter'],
        otherCauses: ['Dust burning off after first seasonal use', 'Dead pest in ductwork'],
        clarifyingQuestions: ['Is the smell musty, burning, or something else?', 'Does it happen only when the system first turns on?'],
        nextCheck: 'Change air filter; check for visible mold or debris',
        steps: ['Replace the air filter.', 'Check visible ducts and vents for mold or debris.', 'If the smell is a brief burning odor at first startup of the season, monitor it.'],
        tools: [],
        parts: ['Air filter'],
        time: '15–20 minutes',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: [],
        stopWhen: 'The smell resembles gas or persists after filter change.',
        safety: 'If it smells like gas or burning insulation, turn off and call immediately',
        pro: 'Mold in ducts or electrical issues require professional service.'
      }
    }
  },
  'doors & windows': {
    dangers: {
      keywords: ['broken glass', 'security', 'leak', 'mold', 'draft'],
      message: 'Door and window issues can affect security and energy efficiency.',
      badge: 'Assess Damage'
    },
    issues: {
      'stuck|sticking|hard to open': {
        causes: ['Loose hinges', 'Frame warping from humidity', 'Paint buildup', 'Contact point rub'],
        otherCauses: ['Foundation settling', 'Swollen wood from moisture'],
        clarifyingQuestions: ['Does it happen more in humid weather?', 'Where does the door rub against the frame?'],
        nextCheck: 'Inspect hinges for loose screws; check for paint or debris on edges',
        steps: ['Tighten all visible hinge screws.', 'Mark where the door contacts the frame with chalk.', 'Sand the contact point lightly if needed.'],
        tools: ['Screwdriver', 'Sandpaper'],
        parts: ['Longer hinge screws'],
        time: '20–40 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: [],
        stopWhen: 'The frame itself appears warped or separated from the wall.',
        safety: 'Low risk',
        pro: 'Major frame damage may need carpenter work.',
        relatedGuideId: 'sticking-door'
      },
      'hinge|hinge loose': {
        causes: ['Loose screws', 'Stripped screw hole', 'Hinge wear'],
        otherCauses: ['Door sagging under its own weight'],
        clarifyingQuestions: [],
        nextCheck: 'Tighten hinge screws; check if door sags',
        steps: ['Tighten each hinge screw.', 'For stripped holes, use a longer screw or wood-filled toothpicks for grip.', 'Check the door for sagging after tightening.'],
        tools: ['Screwdriver'],
        parts: ['Wood toothpicks or matchsticks', 'Longer screws'],
        time: '15–20 minutes',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: [],
        stopWhen: '',
        safety: 'Low risk',
        pro: 'If hinges are damaged, they need replacement.'
      },
      'gap|crack|leak|draft': {
        causes: ['Weatherstripping worn', 'Frame settling', 'Caulk separation'],
        otherCauses: ['Improper installation', 'Seasonal wood shrinkage'],
        clarifyingQuestions: ['Can you feel air movement with your hand along the edges?', 'Is the gap even all the way around or only on one side?'],
        nextCheck: 'Feel for drafts; inspect weatherstripping condition',
        steps: ['Run a hand along the frame edges to locate the draft.', 'Remove old weatherstripping and clean the surface.', 'Apply new weatherstripping or caulk as appropriate.'],
        tools: ['Utility knife', 'Caulk gun'],
        parts: ['Weatherstripping', 'Caulk'],
        time: '30–60 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: [],
        stopWhen: 'The gap is uneven and suggests the frame has shifted.',
        safety: 'Low risk',
        pro: 'Large gaps may indicate structural movement — assess frame alignment.'
      },
      'glass|broken window|cracked': {
        causes: ['Impact damage', 'Thermal stress', 'Seal failure'],
        otherCauses: ['Settling causing pressure on the pane'],
        clarifyingQuestions: ['Is the crack spreading over time?', 'Is the glass a double pane with fogging between layers?'],
        nextCheck: 'Inspect the crack; check if it\'s spreading',
        steps: ['Mark the ends of the crack to monitor spreading.', 'Cover with tape temporarily if there is a risk of pieces falling.', 'Avoid touching sharp edges.'],
        tools: ['Work gloves', 'Tape (temporary)'],
        parts: ['Replacement glass pane'],
        time: 'Inspection only',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'Glass is at risk of falling or has already broken.',
        safety: 'Handle broken glass carefully',
        pro: 'Broken glass should be replaced by a professional to maintain seal and safety.'
      },
      'lock|latch': {
        causes: ['Mechanism wear', 'Misalignment', 'Key issue'],
        otherCauses: ['Door frame shifted, misaligning the strike plate'],
        clarifyingQuestions: [],
        nextCheck: 'Test lock smoothness; check door alignment',
        steps: ['Test the lock and latch for smooth movement.', 'Check the strike plate alignment on the frame.', 'Lubricate the mechanism with graphite or silicone spray.'],
        tools: ['Screwdriver'],
        parts: ['Graphite or silicone lubricant'],
        time: '15–30 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: [],
        stopWhen: '',
        safety: 'Verify security after repair',
        pro: 'If lock is broken, replace for security.'
      }
    }
  },
  other: {
    dangers: {
      keywords: ['crack', 'mold', 'water damage', 'foundation', 'structural', 'decay'],
      message: 'Some general home issues can be serious if they indicate structural problems.',
      badge: 'Have Professional Inspect'
    },
    issues: {
      'hole|drywall damage': {
        causes: ['Impact damage', 'Normal wear'],
        otherCauses: ['Door handle repeatedly hitting the wall'],
        clarifyingQuestions: ['How large is the hole?', 'Is there any damage behind the drywall (pipes/wires)?'],
        nextCheck: 'Assess hole size; check for underlying damage',
        steps: ['Clean loose debris from the hole.', 'For small holes, apply spackling and let dry.', 'For larger holes, cut a patch and secure with drywall tape and joint compound.', 'Sand smooth and repaint.'],
        tools: ['Putty knife', 'Sandpaper'],
        parts: ['Spackling or joint compound', 'Drywall patch'],
        time: '30–90 minutes plus drying time',
        difficulty: LEVELS.BEGINNER.slug,
        tips: ['Add a door stop to prevent repeat damage from a doorknob.'],
        stopWhen: 'You suspect wiring or plumbing may be behind the damaged section.',
        safety: 'Low risk',
        pro: 'Small holes: spackling. Large damage: drywall patch or professional.',
        relatedGuideId: 'drywall-hole-repair'
      },
      'paint|stain|discoloration': {
        causes: ['Water damage', 'Mold', 'Dirt or marks'],
        otherCauses: ['Sun fading', 'Old smoke residue'],
        clarifyingQuestions: ['Is the stain wet to the touch?', 'Does it smell musty?'],
        nextCheck: 'Determine if stain is wet or dry; smell for mustiness',
        steps: ['Touch the area to check for moisture.', 'Smell for mustiness that could indicate mold.', 'Trace upward or outward to find a possible leak source.'],
        tools: ['Flashlight'],
        parts: [],
        time: 'Inspection only',
        difficulty: LEVELS.EASY_CHECK.slug,
        tips: [],
        stopWhen: 'The stain is actively wet or growing.',
        safety: 'If mold is present, handle with proper protection',
        pro: 'Water stains indicate a leak — find and fix the source.'
      },
      'crack|cracks|cracking': {
        causes: ['Normal settling', 'Foundation movement', 'Structural issue'],
        otherCauses: ['Seasonal expansion and contraction'],
        clarifyingQuestions: ['Is the crack wider than a pencil width (1/4 inch)?', 'Is it growing over time?'],
        nextCheck: 'Measure crack width; mark it to watch for growth',
        steps: ['Measure the width of the crack.', 'Mark both ends with a pencil and date.', 'Recheck in a few weeks for growth.'],
        tools: ['Tape measure', 'Pencil'],
        parts: [],
        time: 'Ongoing monitoring',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'The crack is wider than 1/4 inch or growing quickly.',
        safety: 'Monitor for changes',
        pro: 'Wide or rapidly growing cracks need structural engineering evaluation.'
      },
      'floor|squeaky|soft': {
        causes: ['Loose floorboards', 'Moisture damage', 'Subfloor rot'],
        otherCauses: ['Gaps between subfloor and joists'],
        clarifyingQuestions: ['Does it feel soft/spongy underfoot?', 'Is there any visible water source nearby?'],
        nextCheck: 'Check for movement when walking; inspect subfloor if accessible',
        steps: ['Walk the area slowly to find the exact squeaky or soft spot.', 'Check underneath if there is basement or crawlspace access.', 'For squeaks only, try a floor-squeak repair kit.'],
        tools: ['Flashlight'],
        parts: ['Floor squeak repair kit'],
        time: '30–60 minutes',
        difficulty: LEVELS.INTERMEDIATE.slug,
        tips: [],
        stopWhen: 'The floor feels soft or spongy — this can indicate structural rot.',
        safety: 'Do not ignore soft spots — they may indicate structural issues',
        pro: 'Subfloor or joist problems need a structural specialist.',
        relatedGuideId: 'squeaky-floorboard'
      },
      'mold|mildew|moisture': {
        causes: ['Poor ventilation', 'Water leak', 'High humidity'],
        otherCauses: ['Condensation from a cold surface', 'Roof or plumbing leak above'],
        clarifyingQuestions: ['How large is the affected area?', 'Do you know of any recent leaks nearby?'],
        nextCheck: 'Locate moisture source; check ventilation',
        steps: ['Identify and stop the moisture source first.', 'Improve ventilation in the area.', 'For small surface mold, clean with a mild bleach solution and dry thoroughly.'],
        tools: ['Gloves', 'Mask', 'Scrub brush'],
        parts: ['Mold-safe cleaner'],
        time: '30–60 minutes for small areas',
        difficulty: LEVELS.INTERMEDIATE.slug,
        tips: [],
        stopWhen: 'The moldy area is larger than about 10 square feet, or you have respiratory symptoms.',
        safety: 'Wear mask and gloves; ensure good ventilation',
        pro: 'Extensive mold or hidden moisture requires professional remediation.'
      }
    }
  },
  structural: {
    dangers: {
      keywords: ['foundation', 'sagging', 'bowing', 'collapse', 'load-bearing', 'leaning', 'buckling', 'shift'],
      message: 'Structural issues can affect the safety of the whole building. Do not remove walls, supports, or load-bearing elements based on this guidance.',
      badge: 'Structural Engineer / Professional Required'
    },
    issues: {
      'crack|cracks|cracking|foundation': {
        causes: ['Normal settling', 'Foundation movement', 'Soil shifting under the structure'],
        otherCauses: ['Seasonal expansion and contraction', 'Poor drainage around the foundation'],
        clarifyingQuestions: ['Is the crack wider than a pencil width (about 1/4 inch)?', 'Is it growing, stair-stepped, or horizontal?', 'Are doors or windows nearby sticking or misaligned?'],
        nextCheck: 'Measure crack width and mark both ends with a pencil and date to watch for growth',
        steps: ['Measure the width of the crack.', 'Mark both ends with a pencil and today\'s date.', 'Photograph it for comparison.', 'Recheck in a few weeks for growth or new cracks nearby.'],
        tools: ['Tape measure', 'Pencil', 'Camera/phone'],
        parts: [],
        time: 'Ongoing monitoring — repair time varies',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: ['Note whether the crack appears indoors, outdoors, or both — this helps a professional assess it faster.'],
        stopWhen: 'The crack is wider than 1/4 inch, growing quickly, stair-stepped, or accompanied by sagging, leaning, or sticking doors/windows.',
        safety: 'Do not attempt structural repairs yourself; monitor and document only',
        pro: 'Wide, growing, or stair-stepped cracks — or any sign of sagging or leaning — need a structural engineer or licensed contractor evaluation as soon as possible.'
      },
      'sag|sagging|bounc|soft floor|uneven floor': {
        causes: ['Weakened floor joists', 'Moisture damage to framing', 'Undersized support for the span'],
        otherCauses: ['Settling of support posts or beams below'],
        clarifyingQuestions: ['Is the area also soft or spongy to the touch?', 'Is there a basement or crawlspace you can inspect underneath?'],
        nextCheck: 'Inspect visible framing/support from below if safely accessible; avoid extra load on the area',
        steps: ['Avoid placing heavy furniture or extra load on the affected area.', 'If accessible, look underneath for visible water damage, rot, or broken supports — do not enter unsafe crawlspaces alone.', 'Document what you find with photos.'],
        tools: ['Flashlight', 'Camera/phone'],
        parts: [],
        time: 'Inspection only — repair requires a professional',
        difficulty: LEVELS.PROFESSIONAL.slug,
        tips: [],
        stopWhen: 'The sagging is worsening, or you notice cracking, popping sounds, or visible damage to supports.',
        safety: 'Reduce load on the area; do not attempt to jack, shim, or replace structural supports yourself',
        pro: 'Sagging floors or ceilings typically indicate a structural problem that needs a licensed contractor or structural engineer.'
      }
    }
  },
  'home equipment': {
    dangers: {
      keywords: ['carbon monoxide', 'fuel leak', 'gas smell', 'battery acid', 'sparking', 'fire', 'smoke'],
      message: 'This may involve fuel, battery, or exhaust hazards. Do not run the engine or equipment in an enclosed space.',
      badge: 'Stop & Seek Qualified Service'
    },
    issues: {
      'won\'t start|will not start|no start': {
        causes: ['Dead or weak battery', 'Corroded battery terminals', 'Faulty starter or ignition switch'],
        otherCauses: ['Empty fuel tank or stale fuel', 'Blown fuse'],
        clarifyingQuestions: ['Do the lights or dashboard turn on at all?', 'Do you hear clicking, or nothing at all, when you try to start it?'],
        nextCheck: 'Check the battery connections and charge level first',
        steps: ['Check that battery terminals are clean and tightly connected.', 'Check the equipment\'s battery, power source, or fuel level using the manufacturer\'s manual.', 'Check for blown fuses or resettable breakers if they are safely accessible.'],
        tools: ['Multimeter (optional)', 'Work gloves', 'Owner\'s manual'],
        parts: ['Replacement battery, if testing confirms it is dead'],
        time: '15–45 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: ['Never bring an open flame near a battery — batteries can emit flammable hydrogen gas.'],
        stopWhen: 'You smell fuel, see smoke, notice battery swelling/leaking, or sparking occurs.',
        safety: 'Wear eye protection around batteries; avoid sparks near batteries or fuel',
        pro: 'If checking the battery, power source, fuel, or fuses doesn\'t resolve it, a qualified appliance or equipment technician can diagnose the motor, ignition, or power system.'
      },
      'won\'t run|stalls|shuts off|overheating': {
        causes: ['Low fluid levels', 'Clogged air filter', 'Overheating engine or motor'],
        otherCauses: ['Fuel system issue', 'Worn belt or spark plug'],
        clarifyingQuestions: ['Are any warning indicators or gauges showing a problem?', 'Does it happen right away or only after running a while?'],
        nextCheck: 'Check fluid levels and let the equipment cool before inspecting further',
        steps: ['Let the equipment cool down completely before opening anything.', 'Check oil, coolant, or fuel levels per the owner\'s manual, if your equipment uses them.', 'Inspect the air filter for clogging.'],
        tools: ['Owner\'s manual', 'Gloves'],
        parts: ['Air filter', 'Fluids as specified by the manual'],
        time: '20–40 minutes',
        difficulty: LEVELS.BEGINNER.slug,
        tips: [],
        stopWhen: 'The equipment is overheating, you see steam/smoke, or there is a strong fuel smell — let it cool and do not open a hot cooling or fuel system.',
        safety: 'Never open a hot cooling system; work in a ventilated area away from fuel sources',
        pro: 'Persistent stalling, overheating, or warning indicators should be checked by a qualified equipment technician.'
      }
    }
  }
};
