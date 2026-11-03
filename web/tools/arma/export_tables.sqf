[] spawn {
	scopeName "mac";
	if (!isNil "MAC_running") exitWith { hint "MACTABLE: export is already running, wait for done"; };
	private _veh = vehicle player;
	if (_veh == player) exitWith { hint "MACTABLE: get into the artillery gunner seat first"; };
	if (!isNull (uiNamespace getVariable ["ace_artillerytables_rangeTableDialog", displayNull])) exitWith { hint "MACTABLE: close the ACE range table first"; };
	private _vehicleCfg = configOf _veh;
	private _turret = [];
	private _turretCfg = configNull;
	{
		private _c = [_vehicleCfg, _x] call CBA_fnc_getTurret;
		if ((getNumber (_c >> "primaryGunner")) == 1) exitWith { _turret = _x; _turretCfg = _c; };
	} forEach allTurrets _veh;
	if (isNull _turretCfg) exitWith { hint "MACTABLE: no artillery turret (primaryGunner) on this vehicle"; };
	private _weapons = _veh weaponsTurret _turret;
	private _weapon = if ((count _weapons) == 1) then { _weapons select 0 } else { _veh currentWeaponTurret _turret };

	private _animBody = getText (_turretCfg >> "animationSourceBody");
	private _animGun = getText (_turretCfg >> "animationSourceGun");
	private _elevRad = _veh animationSourcePhase _animGun;
	if (isNil "_elevRad") then { _elevRad = _veh animationPhase _animGun; };
	private _travRad = _veh animationSourcePhase _animBody;
	if (isNil "_travRad") then { _travRad = _veh animationPhase _animBody; };
	private _weaponDir = _veh weaponDirection _weapon;
	private _turretRot = [vectorDir _veh, vectorUp _veh, deg _travRad] call CBA_fnc_vectRotate3D;
	private _neutralX = (acos ((_turretRot vectorCos _weaponDir) min 1)) - (deg _elevRad);
	_neutralX = (round (_neutralX * 10)) / 10;
	private _minElev = _neutralX + getNumber (_turretCfg >> "minElev");
	private _maxElev = _neutralX + getNumber (_turretCfg >> "maxElev");

	private _apply = if (isNumber (_vehicleCfg >> "ace_artillerytables_applyCorrections")) then {
		getNumber (_vehicleCfg >> "ace_artillerytables_applyCorrections")
	} else {
		getNumber (_vehicleCfg >> "artilleryScanner")
	};
	private _advOn = (_apply == 1) || {_veh isKindOf "Mortar_01_base_F"};

	private _magCfg = configFile >> "CfgMagazines";
	private _afOf = {
		params ["_mag", "_adv"];
		private _af = 0;
		private _key = getNumber (_magCfg >> _mag >> "ace_artillerytables_airFriction");
		if (_key <= 0) then {
			if (_adv) then { _af = [-0.00006, _key] select (isNumber (_magCfg >> _mag >> "ace_artillerytables_airFriction")); };
		} else {
			_af = getNumber (configFile >> "CfgAmmo" >> (getText (_magCfg >> _mag >> "ammo")) >> "airFriction");
		};
		_af
	};

	private _mags = [_weapon] call CBA_fnc_compatibleMagazines;
	if (_mags isEqualTo []) exitWith { hint "MACTABLE: no magazines for this weapon"; };
	private _groups = [];
	private _groupMags = [];
	{
		private _key = [getNumber (_magCfg >> _x >> "initSpeed"), [_x, false] call _afOf, [_x, _advOn] call _afOf];
		private _i = _groups find _key;
		if (_i < 0) then { _i = count _groups; _groups pushBack _key; _groupMags pushBack []; };
		(_groupMags select _i) pushBack _x;
	} forEach _mags;

	private _modes = getArray (configFile >> "CfgWeapons" >> _weapon >> "modes");
	_modes = (_modes apply { configFile >> "CfgWeapons" >> _weapon >> _x }) select { 1 == getNumber (_x >> "showToPlayer") };
	_modes = _modes apply { [getNumber (_x >> "artilleryCharge"), configName _x] };
	_modes sort true;
	if (_modes isEqualTo []) exitWith { hint "MACTABLE: no visible fire modes"; };

	MAC_running = true;
	MAC_rows = createHashMap;
	private _eh = addMissionEventHandler ["ExtensionCallback", {
		params ["_name", "_function", "_data"];
		if (_name == "ace:artillery" && {_function == "calculate_table"}) then {
			(parseSimpleArray _data) params ["_line", "_row"];
			if (!isNil "_line") then { MAC_rows set [_line, if (isNil "_row") then { 0 } else { _row }]; };
		};
	}];

	private _lines = [];
	private _out = { _lines pushBack _this; diag_log text _this; };
	(format ["MACTABLE|BEGIN|1|%1|%2|%3|%4|%5|%6", typeOf _veh, _weapon, _minElev, _maxElev, _apply, getText (_vehicleCfg >> "displayName")]) call _out;
	private _total = 0;
	{
		private _g = _forEachIndex;
		_x params ["_speed", "_afOff", "_afOn"];
		(format ["MACTABLE|GROUP|%1|%2|%3", _g, _speed, (_groupMags select _g) joinString ","]) call _out;
		private _phys = [["noair", _afOff]];
		if (_afOn != _afOff) then { _phys pushBack ["air", _afOn]; };
		{
			_x params ["_physName", "_af"];
			{
				private _high = _x;
				private _modeName = ["LOW", "HIGH"] select _high;
				{
					private _charge = _forEachIndex;
					private _mv = _speed * (_x select 0);
					MAC_rows = createHashMap;
					ace_artillerytables_tableSizeActual = -1;
					ace_artillerytables_tableSizeReceived = 0;
					ace_artillerytables_tableData = createHashMap;
					private _ret = "ace" callExtension ["artillery:calculate_table", [_mv, _af, _minElev, _maxElev, _high]];
					private _parsed = parseSimpleArray (_ret select 0);
					if (!(_parsed isEqualType []) || {(count _parsed) < 2}) then {
						removeMissionEventHandler ["ExtensionCallback", _eh];
						MAC_running = nil;
						hint "MACTABLE: ACE extension did not answer (ACE older than 3.18?)";
						breakOut "mac";
					};
					private _n = _parsed select 1;
					private _deadline = diag_tickTime + 15;
					waitUntil { ((count MAC_rows) >= _n) || {diag_tickTime > _deadline} };
					if ((count MAC_rows) < _n) then { uiSleep 2; };
					private _rows = [];
					for "_i" from 0 to (_n - 1) do {
						private _r = MAC_rows getOrDefault [_i, 0];
						if ((_r isEqualType []) && {(count _r) == 12}) then { _rows pushBack (_r joinString " "); };
					};
					(format ["MACTABLE|TABLE|%1|%2|%3|%4|%5|%6|%7|%8|%9", _g, _physName, _modeName, _charge, _mv, _af, _n, count _rows, count MAC_rows]) call _out;
					{ (format ["MACTABLE|ROW|%1|%2|%3|%4|%5", _g, _physName, _modeName, _charge, _x]) call _out; } forEach _rows;
					_total = _total + 1;
					hintSilent format ["MACTABLE: %1 tables", _total];
				} forEach _modes;
			} forEach [true, false];
		} forEach _phys;
	} forEach _groups;

	removeMissionEventHandler ["ExtensionCallback", _eh];
	MAC_running = nil;
	ace_artillerytables_tableSizeActual = -1;
	ace_artillerytables_tableSizeReceived = 0;
	(format ["MACTABLE|END|%1", _total]) call _out;
	copyToClipboard (_lines joinString (toString [13, 10]));
	hint format ["MACTABLE: done, %1 tables. Copied to clipboard and written to RPT.", _total];
};
