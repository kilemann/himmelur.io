'use strict';
const path = require('node:path');
const { loadApp } = require('./harness');

const HTML = path.join(__dirname, '..', 'index.html');
const NAMES = [
  // astronomi
  'DELTA_T', 'jdOf', 'sunPos', 'moonPos', 'gmst', 'horizontal', 'refract', 'sunH', 'moonH', 'dayEvents',
  'moonPhase', 'nextPhase', 'season', 'nextSeason', 'phaseName',
  // tid og format
  'norm', 'parts', 'tzOffset', 'localMidnight', 'hm', 'dec', 'dur', 'compass', 'nextDay', 'prevDay', 'isoWeek', 'MONTHS',
  // sted
  'CITIES', 'DEFAULT_CITY', 'matches', 'parseCoord', 'toLoc', 'distKm', 'nearestCity', 'loadLoc', 'saveLoc',
  // tilstand og skjerm
  'loc', 'sel', 'day', 'calView', 'todayYMD', 'shownMs', 'computeDay', 'setLoc', 'tick', 'stepDay', 'pickDate',
  'resetToday', 'openCal', 'closeCal', 'renderCal', 'stepMonth', 'submitCity', 'showSugg',
];

function load(opts = {}) { return loadApp(HTML, NAMES, opts); }
module.exports = { load, HTML, NAMES };
