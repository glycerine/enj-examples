"use strict";
Error.stackTraceLimit = -1;

var go$reservedKeywords = ["abstract", "arguments", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double", "else", "enum", "eval", "export", "extends", "false", "final", "finally", "float", "for", "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface", "let", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield"];

var go$global;
if (typeof window !== "undefined") {
	go$global = window;
} else if (typeof GLOBAL !== "undefined") {
	go$global = GLOBAL;
}

var go$idCounter = 1;
var go$keys = function(m) { return m ? Object.keys(m) : []; };
var go$min = Math.min;
var go$parseInt = parseInt;
var go$parseFloat = parseFloat;
var go$reflect, go$newStringPtr;
var Go$Error = Error;

var go$mapArray = function(array, f) {
	var newArray = new array.constructor(array.length), i;
	for (i = 0; i < array.length; i += 1) {
		newArray[i] = f(array[i]);
	}
	return newArray;
};

var go$newType = function(size, kind, string, name, pkgPath, constructor) {
	var typ;
	switch(kind) {
	case "Bool":
	case "Int":
	case "Int8":
	case "Int16":
	case "Int32":
	case "Uint":
	case "Uint8" :
	case "Uint16":
	case "Uint32":
	case "Uintptr":
	case "Float32":
	case "Float64":
	case "String":
	case "UnsafePointer":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + this.go$val; };
		break;

	case "Int64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Uint64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >>> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break

	case "Complex64":
	case "Complex128":
		typ = function(real, imag) {
			this.real = real;
			this.imag = imag;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.real + "$" + this.imag; };
		break;

	case "Array":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", function(array) {
			this.go$get = function() { return array; };
			this.go$val = array;
		});
		typ.init = function(elem, len) {
			typ.elem = elem;
			typ.len = len;
			typ.prototype.go$key = function() {
				return string + "$" + go$mapArray(this.go$val, function(e) {
					var key = e.go$key ? e.go$key() : String(e);
					return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}).join("$");
			};
			typ.extendReflectType = function(rt) {
				rt.arrayType = new go$reflect.arrayType(rt, elem.reflectType(), undefined, len);
			};
			typ.Ptr.init(typ);
		};
		break;

	case "Chan":
		typ = function() { this.go$val = this; };
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				this.go$id = go$idCounter;
				go$idCounter += 1;
			}
			return String(this.go$id);
		};
		typ.init = function(elem, sendOnly, recvOnly) {
			typ.nil = new typ();
			typ.extendReflectType = function(rt) {
				rt.chanType = new go$reflect.chanType(rt, elem.reflectType(), sendOnly ? go$reflect.SendDir : (recvOnly ? go$reflect.RecvDir : go$reflect.BothDir));
			};
		};
		break;

	case "Func":
		typ = function(v) { this.go$val = v; };
		typ.init = function(params, results, isVariadic) {
			typ.params = params;
			typ.results = results;
			typ.isVariadic = isVariadic;
			typ.extendReflectType = function(rt) {
				var typeSlice = (go$sliceType(go$ptrType(go$reflect.rtype)));
				rt.funcType = new go$reflect.funcType(rt, isVariadic, new typeSlice(go$mapArray(params, function(p) { return p.reflectType(); })), new typeSlice(go$mapArray(results, function(p) { return p.reflectType(); })));
			};
		};
		break;

	case "Interface":
		typ = { implementedBy: [] };
		typ.init = function(methods) {
			typ.extendReflectType = function(rt) {
				var imethods = go$mapArray(methods, function(m) {
					return new go$reflect.imethod(go$newStringPtr(m[0]), go$newStringPtr(m[1]), m[2].reflectType());
				});
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.imethod)));
				rt.interfaceType = new go$reflect.interfaceType(rt, new methodSlice(imethods));
			};
		};
		break;

	case "Map":
		typ = function(v) { this.go$val = v; };
		typ.init = function(key, elem) {
			typ.key = key;
			typ.elem = elem;
			typ.extendReflectType = function(rt) {
				rt.mapType = new go$reflect.mapType(rt, key.reflectType(), elem.reflectType(), undefined, undefined);
			};
		};
		break;

	case "Ptr":
		typ = constructor || function(getter, setter) {
			this.go$get = getter;
			this.go$set = setter;
			this.go$val = this;
		};
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				this.go$id = go$idCounter;
				go$idCounter += 1;
			}
			return String(this.go$id);
		};
		typ.init = function(elem) {
			typ.nil = new typ(go$throwNilPointerError, go$throwNilPointerError);
			typ.extendReflectType = function(rt) {
				rt.ptrType = new go$reflect.ptrType(rt, elem.reflectType());
			};
		}
		break;

	case "Slice":
		var nativeArray;
		typ = function(array) {
			if (array.constructor !== nativeArray) {
				array = new nativeArray(array);
			}
			this.array = array;
			this.offset = 0;
			this.length = array.length;
			this.capacity = array.length;
			this.go$val = this;
		};
		typ.make = function(length, capacity, zero) {
			capacity = capacity || length;
			var array = new nativeArray(capacity), i;
			for (i = 0; i < capacity; i += 1) {
				array[i] = zero();
			}
			var slice = new typ(array);
			slice.length = length;
			return slice;
		};
		typ.init = function(elem) {
			typ.elem = elem;
			nativeArray = go$nativeArray(elem.kind);
			typ.nil = new typ([]);
			typ.extendReflectType = function(rt) {
				rt.sliceType = new go$reflect.sliceType(rt, elem.reflectType());
			};
		};
		break;

	case "Struct":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", constructor);
		typ.Ptr.Struct = typ;
		typ.init = function(fields) {
			typ.Ptr.nil = new constructor();
			var i;
			for (i = 0; i < fields.length; i++) {
				var field = fields[i];
				Object.defineProperty(typ.Ptr.nil, field[0], { get: go$throwNilPointerError, set: go$throwNilPointerError });
			}
			typ.prototype.go$key = function() {
				var keys = new Array(fields.length);
				for (i = 0; i < fields.length; i++) {
					var v = this.go$val[go$fieldName(fields, i)];
					var key = v.go$key ? v.go$key() : String(v);
					keys[i] = key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}
				return string + "$" + keys.join("$");
			};
			typ.extendReflectType = function(rt) {
				var reflectFields = new Array(fields.length), i;
				for (i = 0; i < fields.length; i++) {
					var field = fields[i];
					reflectFields[i] = new go$reflect.structField(go$newStringPtr(field[0]), go$newStringPtr(field[1]), field[2].reflectType(), go$newStringPtr(field[3]), i);
				}
				rt.structType = new go$reflect.structType(rt, new (go$sliceType(go$reflect.structField))(reflectFields));
			};
			typ.Ptr.init(typ);
		};
		break;

	default:
		throw go$panic("invalid kind: " + kind);
	}

	typ.kind = kind;
	typ.string = string;
	typ.typeName = name;
	typ.pkgPath = pkgPath;
	var rt = null;
	typ.reflectType = function() {
		if (rt === null) {
			rt = new go$reflect.rtype(size, 0, 0, 0, 0, go$reflect.kinds[kind], undefined, undefined, go$newStringPtr(string), undefined, undefined);
			rt.jsType = typ;

			var methods = [];
			if (typ.methods !== undefined) {
				var i;
				for (i = 0; i < typ.methods.length; i++) {
					var m = typ.methods[i];
					methods.push(new go$reflect.method(go$newStringPtr(m[0]), go$newStringPtr(m[1]), go$funcType(m[2], m[3], m[4]).reflectType(), go$funcType([typ].concat(m[2]), m[3], m[4]).reflectType(), undefined, undefined));
				}
			}
			if (name !== "" || methods.length !== 0) {
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.method)));
				rt.uncommonType = new go$reflect.uncommonType(go$newStringPtr(name), go$newStringPtr(pkgPath), new methodSlice(methods));
			}

			if (typ.extendReflectType !== undefined) {
				typ.extendReflectType(rt);
			}
		}
		return rt;
	};
	return typ;
};

var Go$Bool          = go$newType( 1, "Bool",          "bool",           "bool",       "", null);
var Go$Int           = go$newType( 4, "Int",           "int",            "int",        "", null);
var Go$Int8          = go$newType( 1, "Int8",          "int8",           "int8",       "", null);
var Go$Int16         = go$newType( 2, "Int16",         "int16",          "int16",      "", null);
var Go$Int32         = go$newType( 4, "Int32",         "int32",          "int32",      "", null);
var Go$Int64         = go$newType( 8, "Int64",         "int64",          "int64",      "", null);
var Go$Uint          = go$newType( 4, "Uint",          "uint",           "uint",       "", null);
var Go$Uint8         = go$newType( 1, "Uint8",         "uint8",          "uint8",      "", null);
var Go$Uint16        = go$newType( 2, "Uint16",        "uint16",         "uint16",     "", null);
var Go$Uint32        = go$newType( 4, "Uint32",        "uint32",         "uint32",     "", null);
var Go$Uint64        = go$newType( 8, "Uint64",        "uint64",         "uint64",     "", null);
var Go$Uintptr       = go$newType( 4, "Uintptr",       "uintptr",        "uintptr",    "", null);
var Go$Float32       = go$newType( 4, "Float32",       "float32",        "float32",    "", null);
var Go$Float64       = go$newType( 8, "Float64",       "float64",        "float64",    "", null);
var Go$Complex64     = go$newType( 8, "Complex64",     "complex64",      "complex64",  "", null);
var Go$Complex128    = go$newType(16, "Complex128",    "complex128",     "complex128", "", null);
var Go$String        = go$newType( 0, "String",        "string",         "string",     "", null);
var Go$UnsafePointer = go$newType( 4, "UnsafePointer", "unsafe.Pointer", "Pointer",    "", null);

var go$nativeArray = function(elemKind) {
	return ({ Int: Int32Array, Int8: Int8Array, Int16: Int16Array, Int32: Int32Array, Uint: Uint32Array, Uint8: Uint8Array, Uint16: Uint16Array, Uint32: Uint32Array, Uintptr: Uint32Array, Float32: Float32Array, Float64: Float64Array })[elemKind] || Array;
};
var go$toNativeArray = function(elemKind, array) {
	var nativeArray = go$nativeArray(elemKind);
	if (nativeArray === Array) {
		return array;
	}
	return new nativeArray(array);
};
var go$makeNativeArray = function(elemKind, length, zero) {
	var array = new (go$nativeArray(elemKind))(length), i;
	for (i = 0; i < length; i += 1) {
		array[i] = zero();
	}
	return array;
};
var go$arrayTypes = {};
var go$arrayType = function(elem, len) {
	var string = "[" + len + "]" + elem.string;
	var typ = go$arrayTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Array", string, "", "", null);
		typ.init(elem, len);
		go$arrayTypes[string] = typ;
	}
	return typ;
};

var go$chanType = function(elem, sendOnly, recvOnly) {
	var string = (recvOnly ? "<-" : "") + "chan" + (sendOnly ? "<- " : " ") + elem.string;
	var field = sendOnly ? "SendChan" : (recvOnly ? "RecvChan" : "Chan");
	var typ = elem[field];
	if (typ === undefined) {
		typ = go$newType(0, "Chan", string, "", "", null);
		typ.init(elem, sendOnly, recvOnly);
		elem[field] = typ;
	}
	return typ;
};

var go$funcTypes = {};
var go$funcType = function(params, results, isVariadic) {
	var paramTypes = go$mapArray(params, function(p) { return p.string; });
	if (isVariadic) {
		paramTypes[paramTypes.length - 1] = "..." + paramTypes[paramTypes.length - 1].substr(2);
	}
	var string = "func(" + paramTypes.join(", ") + ")";
	if (results.length === 1) {
		string += " " + results[0].string;
	} else if (results.length > 1) {
		string += " (" + go$mapArray(results, function(r) { return r.string; }).join(", ") + ")"
	}
	var typ = go$funcTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Func", string, "", "", null);
		typ.init(params, results, isVariadic);
		go$funcTypes[string] = typ;
	}
	return typ;
};

var go$interfaceTypes = {};
var go$interfaceType = function(methods) {
	var string = "interface {}";
	if (methods.length !== 0) {
		string = "interface { " + go$mapArray(methods, function(m) {
			return (m[1] !== "" ? m[1] + "." : "") + m[0] + m[2].string.substr(4);
		}).join("; ") + " }";
	}
	var typ = go$interfaceTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Interface", string, "", "", null);
		typ.init(methods);
		go$interfaceTypes[string] = typ;
	}
	return typ;
};
var go$interfaceNil = { go$key: function() { return "nil"; } };
var go$error = go$newType(8, "Interface", "error", "error", "", null);
go$error.init([["Error", "", go$funcType([], [Go$String], false)]]);

var Go$Map = function() {};
(function() {
	var names = Object.getOwnPropertyNames(Object.prototype), i;
	for (i = 0; i < names.length; i += 1) {
		Go$Map.prototype[names[i]] = undefined;
	}
})();
var go$mapTypes = {};
var go$mapType = function(key, elem) {
	var string = "map[" + key.string + "]" + elem.string;
	var typ = go$mapTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Map", string, "", "", null);
		typ.init(key, elem);
		go$mapTypes[string] = typ;
	}
	return typ;
};

var go$throwNilPointerError = function() { go$throwRuntimeError("invalid memory address or nil pointer dereference"); };
var go$ptrType = function(elem) {
	var typ = elem.Ptr;
	if (typ === undefined) {
		typ = go$newType(0, "Ptr", "*" + elem.string, "", "", null);
		typ.init(elem);
		elem.Ptr = typ;
	}
	return typ;
};

var go$sliceType = function(elem) {
	var typ = elem.Slice;
	if (typ === undefined) {
		typ = go$newType(0, "Slice", "[]" + elem.string, "", "", null);
		typ.init(elem);
		elem.Slice = typ;
	}
	return typ;
};

var go$fieldName = function(fields, i) {
	var field = fields[i];
	var name = field[0];
	if (name === "") {
		var ntyp = field[2];
		if (ntyp.kind === "Ptr") {
			ntyp = ntyp.elem;
		}
		return ntyp.typeName;
	}
	if (name === "_" || go$reservedKeywords.indexOf(name) != -1) {
		return name + "$" + i;
	}
	return name;
};

var go$structTypes = {};
var go$structType = function(fields) {
	var string = "struct { " + go$mapArray(fields, function(f) {
		return f[0] + " " + f[2].string + (f[3] !== "" ? (' "' + f[3].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"') : "");
	}).join("; ") + " }";
	var typ = go$structTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Struct", string, "", "", function() {
			this.go$val = this;
			var i;
			for (i = 0; i < fields.length; i++) {
				this[go$fieldName(fields, i)] = arguments[i];
			}
		});
		typ.init(fields);
		var i, j;
		for (i = 0; i < fields.length; i++) {
			var field = fields[i];
			if (field[0] === "" && field[2].prototype !== undefined) {
				var methods = Object.keys(field[2].prototype);
				for (j = 0; j < methods.length; j += 1) {
					(function(fieldName, methodName, method) {
						typ.prototype[methodName] = function() {
							return method.apply(this.go$val[fieldName], arguments);
						};
						typ.Ptr.prototype[methodName] = function() {
							return method.apply(this[fieldName], arguments);
						};
					})(field[0], methods[j], field[2].prototype[methods[j]]);
				}
			}
		}
		go$structTypes[string] = typ;
	}
	return typ;
};

var go$stringPtrMap = new Go$Map();
go$newStringPtr = function(str) {
	if (str === undefined || str === "") {
		return go$ptrType(Go$String).nil;
	}
	var ptr = go$stringPtrMap[str];
	if (ptr === undefined) {
		ptr = new (go$ptrType(Go$String))(function() { return str; }, function(v) { str = v; });
		go$stringPtrMap[str] = ptr;
	}
	return ptr;
};
var go$newDataPointer = function(data, constructor) {
	return new constructor(function() { return data; }, function(v) { data = v; });
};

var go$float32bits = function(f) {
	var s, e;
	if (f === 0) {
		if (f === 0 && 1 / f === 1 / -0) {
			return 2147483648;
		}
		return 0;
	}
	if (!(f === f)) {
		return 2143289344;
	}
	s = 0;
	if (f < 0) {
		s = 2147483648;
		f = -f;
	}
	e = 150;
	while (f >= 1.6777216e+07) {
		f = f / (2);
		if (e === 255) {
			break;
		}
		e = (e + (1) >>> 0);
	}
	while (f < 8.388608e+06) {
		e = (e - (1) >>> 0);
		if (e === 0) {
			break;
		}
		f = f * (2);
	}
	return ((((s | (((e >>> 0) << 23) >>> 0)) >>> 0) | ((((((f + 0.5) >> 0) >>> 0) &~ 8388608) >>> 0))) >>> 0);
};

var go$flatten64 = function(x) {
	return x.high * 4294967296 + x.low;
};
var go$shiftLeft64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high << y | x.low >>> (32 - y), (x.low << y) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.low << (y - 32), 0);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightInt64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.high >> 31, (x.high >> (y - 32)) >>> 0);
	}
	if (x.high < 0) {
		return new x.constructor(-1, 4294967295);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightUint64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >>> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(0, x.high >>> (y - 32));
	}
	return new x.constructor(0, 0);
};
var go$mul64 = function(x, y) {
	var high = 0, low = 0, i;
	if ((y.low & 1) !== 0) {
		high = x.high;
		low = x.low;
	}
	for (i = 1; i < 32; i += 1) {
		if ((y.low & 1<<i) !== 0) {
			high += x.high << i | x.low >>> (32 - i);
			low += (x.low << i) >>> 0;
		}
	}
	for (i = 0; i < 32; i += 1) {
		if ((y.high & 1<<i) !== 0) {
			high += x.low << i;
		}
	}
	return new x.constructor(high, low);
};
var go$div64 = function(x, y, returnRemainder) {
	if (y.high === 0 && y.low === 0) {
		go$throwRuntimeError("integer divide by zero");
	}

	var s = 1;
	var rs = 1;

	var xHigh = x.high;
	var xLow = x.low;
	if (xHigh < 0) {
		s = -1;
		rs = -1;
		xHigh = -xHigh;
		if (xLow !== 0) {
			xHigh -= 1;
			xLow = 4294967296 - xLow;
		}
	}

	var yHigh = y.high;
	var yLow = y.low;
	if (y.high < 0) {
		s *= -1;
		yHigh = -yHigh;
		if (yLow !== 0) {
			yHigh -= 1;
			yLow = 4294967296 - yLow;
		}
	}

	var high = 0, low = 0, n = 0, i;
	while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
		yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
		yLow = (yLow << 1) >>> 0;
		n += 1;
	}
	for (i = 0; i <= n; i += 1) {
		high = high << 1 | low >>> 31;
		low = (low << 1) >>> 0;
		if ((xHigh > yHigh) || (xHigh === yHigh && xLow >= yLow)) {
			xHigh = xHigh - yHigh;
			xLow = xLow - yLow;
			if (xLow < 0) {
				xHigh -= 1;
				xLow += 4294967296;
			}
			low += 1;
			if (low === 4294967296) {
				high += 1;
				low = 0;
			}
		}
		yLow = (yLow >>> 1 | yHigh << (32 - 1)) >>> 0;
		yHigh = yHigh >>> 1;
	}

	if (returnRemainder) {
		return new x.constructor(xHigh * rs, xLow * rs);
	}
	return new x.constructor(high * s, low * s);
};

var go$divComplex = function(n, d) {
	var ninf = n.real === 1/0 || n.real === -1/0 || n.imag === 1/0 || n.imag === -1/0;
	var dinf = d.real === 1/0 || d.real === -1/0 || d.imag === 1/0 || d.imag === -1/0;
	var nnan = !ninf && (n.real !== n.real || n.imag !== n.imag);
	var dnan = !dinf && (d.real !== d.real || d.imag !== d.imag);
	if(nnan || dnan) {
		return new n.constructor(0/0, 0/0);
	}
	if (ninf && !dinf) {
		return new n.constructor(1/0, 1/0);
	}
	if (!ninf && dinf) {
		return new n.constructor(0, 0);
	}
	if (d.real === 0 && d.imag === 0) {
		if (n.real === 0 && n.imag === 0) {
			return new n.constructor(0/0, 0/0);
		}
		return new n.constructor(1/0, 1/0);
	}
	var a = Math.abs(d.real);
	var b = Math.abs(d.imag);
	if (a <= b) {
		var ratio = d.real / d.imag;
		var denom = d.real * ratio + d.imag;
		return new n.constructor((n.real * ratio + n.imag) / denom, (n.imag * ratio - n.real) / denom);
	}
	var ratio = d.imag / d.real;
	var denom = d.imag * ratio + d.real;
	return new n.constructor((n.imag * ratio + n.real) / denom, (n.imag - n.real * ratio) / denom);
};

var go$subslice = function(slice, low, high, max) {
	if (low < 0 || high < low || max < high || high > slice.capacity || max > slice.capacity) {
		go$throwRuntimeError("slice bounds out of range");
	}
	var s = new slice.constructor(slice.array);
	s.offset = slice.offset + low;
	s.length = slice.length - low;
	s.capacity = slice.capacity - low;
	if (high !== undefined) {
		s.length = high - low;
	}
	if (max !== undefined) {
		s.capacity = max - low;
	}
	return s;
};

var go$sliceToArray = function(slice) {
	if (slice.length === 0) {
		return [];
	}
	if (slice.array.constructor !== Array) {
		return slice.array.subarray(slice.offset, slice.offset + slice.length);
	}
	return slice.array.slice(slice.offset, slice.offset + slice.length);
};

var go$decodeRune = function(str, pos) {
	var c0 = str.charCodeAt(pos)

	if (c0 < 0x80) {
		return [c0, 1];
	}

	if (c0 !== c0 || c0 < 0xC0) {
		return [0xFFFD, 1];
	}

	var c1 = str.charCodeAt(pos + 1)
	if (c1 !== c1 || c1 < 0x80 || 0xC0 <= c1) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xE0) {
		var r = (c0 & 0x1F) << 6 | (c1 & 0x3F);
		if (r <= 0x7F) {
			return [0xFFFD, 1];
		}
		return [r, 2];
	}

	var c2 = str.charCodeAt(pos + 2)
	if (c2 !== c2 || c2 < 0x80 || 0xC0 <= c2) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF0) {
		var r = (c0 & 0x0F) << 12 | (c1 & 0x3F) << 6 | (c2 & 0x3F);
		if (r <= 0x7FF) {
			return [0xFFFD, 1];
		}
		if (0xD800 <= r && r <= 0xDFFF) {
			return [0xFFFD, 1];
		}
		return [r, 3];
	}

	var c3 = str.charCodeAt(pos + 3)
	if (c3 !== c3 || c3 < 0x80 || 0xC0 <= c3) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF8) {
		var r = (c0 & 0x07) << 18 | (c1 & 0x3F) << 12 | (c2 & 0x3F) << 6 | (c3 & 0x3F);
		if (r <= 0xFFFF || 0x10FFFF < r) {
			return [0xFFFD, 1];
		}
		return [r, 4];
	}

	return [0xFFFD, 1];
};

var go$encodeRune = function(r) {
	if (r < 0 || r > 0x10FFFF || (0xD800 <= r && r <= 0xDFFF)) {
		r = 0xFFFD;
	}
	if (r <= 0x7F) {
		return String.fromCharCode(r);
	}
	if (r <= 0x7FF) {
		return String.fromCharCode(0xC0 | r >> 6, 0x80 | (r & 0x3F));
	}
	if (r <= 0xFFFF) {
		return String.fromCharCode(0xE0 | r >> 12, 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
	}
	return String.fromCharCode(0xF0 | r >> 18, 0x80 | (r >> 12 & 0x3F), 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
};

var go$stringToBytes = function(str, terminateWithNull) {
	var array = new Uint8Array(terminateWithNull ? str.length + 1 : str.length), i;
	for (i = 0; i < str.length; i += 1) {
		array[i] = str.charCodeAt(i);
	}
	if (terminateWithNull) {
		array[str.length] = 0;
	}
	return array;
};

var go$bytesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i += 10000) {
		str += String.fromCharCode.apply(null, slice.array.subarray(slice.offset + i, slice.offset + Math.min(slice.length, i + 10000)));
	}
	return str;
};

var go$stringToRunes = function(str) {
	var array = new Int32Array(str.length);
	var rune, i, j = 0;
	for (i = 0; i < str.length; i += rune[1], j += 1) {
		rune = go$decodeRune(str, i);
		array[j] = rune[0];
	}
	return array.subarray(0, j);
};

var go$runesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i += 1) {
		str += go$encodeRune(slice.array[slice.offset + i]);
	}
	return str;
};

var go$needsExternalization = function(t) {
	switch (t.kind) {
		case "Int64":
		case "Uint64":
		case "Array":
		case "Func":
		case "Interface":
		case "Map":
		case "Slice":
		case "String":
			return true;
		default:
			return false;
	}
};

var go$externalize = function(v, t) {
	switch (t.kind) {
	case "Int64":
	case "Uint64":
		return go$flatten64(v);
	case "Array":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(v, function(e) { return go$externalize(e, t.elem); });
		}
		return v;
	case "Func":
		if (v === go$throwNilPointerError) {
			return null;
		}
		var convert = false;
		var i;
		for (i = 0; i < t.params.length; i += 1) {
			convert = convert || (t.params[i] !== go$packages["github.com/neelance/gopherjs/js"].Object);
		}
		for (i = 0; i < t.results.length; i += 1) {
			convert = convert || go$needsExternalization(t.results[i]);
		}
		if (!convert) {
			return v;
		}
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i += 1) {
				if (t.isVariadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = [], j;
					for (j = i; j < arguments.length; j += 1) {
						varargs.push(go$internalize(arguments[j], vt));
					}
					args.push(new (t.params[i])(varargs));
					break;
				}
				args.push(go$internalize(arguments[i], t.params[i]));
			}
			var result = v.apply(undefined, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$externalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$externalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (v === null) {
			return null;
		}
		if (v.constructor.kind === undefined) {
			return v; // js.Object
		}
		return go$externalize(v.go$val, v.constructor);
	case "Map":
		var m = {};
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i += 1) {
			var entry = v[keys[i]];
			m[go$externalize(entry.k, t.key)] = go$externalize(entry.v, t.elem);
		}
		return m;
	case "Slice":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(go$sliceToArray(v), function(e) { return go$externalize(e, t.elem); });
		}
		return go$sliceToArray(v);
	case "String":
		var s = "", r, i, j = 0;
		for (i = 0; i < v.length; i += r[1], j += 1) {
			r = go$decodeRune(v, i);
			s += String.fromCharCode(r[0]);
		}
		return s;
	case "Struct":
		var timePkg = go$packages["time"];
		if (timePkg && v.constructor === timePkg.Time.Ptr) {
			var milli = go$div64(v.UnixNano(), new Go$Int64(0, 1000000));
			return new Date(go$flatten64(milli));
		}
		return v;
	default:
		return v;
	}
};

var go$internalize = function(v, t) {
	switch (t.kind) {
	case "Bool":
		return !!v;
	case "Int":
		return parseInt(v);
	case "Int8":
		return parseInt(v) << 24 >> 24;
	case "Int16":
		return parseInt(v) << 16 >> 16;
	case "Int32":
		return parseInt(v) >> 0;
	case "Uint":
		return parseInt(v);
	case "Uint8" :
		return parseInt(v) << 24 >>> 24;
	case "Uint16":
		return parseInt(v) << 16 >>> 16;
	case "Uint32":
	case "Uintptr":
		return parseInt(v) >>> 0;
	case "Int64":
	case "Uint64":
		return new t(0, v);
	case "Float32":
	case "Float64":
		return parseFloat(v);
	case "Array":
		if (v.length !== t.len) {
			throw go$panic("got array with wrong size from JavaScript native");
		}
		return go$mapArray(v, function(e) { return go$internalize(e, t.elem); });
	case "Func":
		return new t(function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i += 1) {
				if (t.isVariadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = arguments[i], j;
					for (j = 0; j < varargs.length; j += 1) {
						args.push(go$externalize(varargs.array[varargs.offset + j], vt));
					}
					break;
				}
				args.push(go$externalize(arguments[i], t.params[i]));
			}
			var result = v.apply(undefined, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$internalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$internalize(result[i], t.results[i]);
				}
				return result;
			}
		});
	case "Interface":
		if (t === go$packages["github.com/neelance/gopherjs/js"].Object) {
			return v;
		}
		switch (v.constructor) {
		case Int8Array:
			return new (go$sliceType(Go$Int8))(v);
		case Int16Array:
			return new (go$sliceType(Go$Int16))(v);
		case Int32Array:
			return new (go$sliceType(Go$Int))(v);
		case Uint8Array:
			return new (go$sliceType(Go$Uint8))(v);
		case Uint16Array:
			return new (go$sliceType(Go$Uint16))(v);
		case Uint32Array:
			return new (go$sliceType(Go$Uint))(v);
		case Float32Array:
			return new (go$sliceType(Go$Float32))(v);
		case Float64Array:
			return new (go$sliceType(Go$Float64))(v);
		case Array:
			return go$internalize(v, go$sliceType(go$interfaceType([])));
		case Boolean:
			return new Go$Bool(!!v);
		case Date:
			var timePkg = go$packages["time"];
			if (timePkg) {
				return new timePkg.Time(timePkg.Unix(new Go$Int64(0, 0), new Go$Int64(0, v.getTime() * 1000000)));
			}
		case Function:
			return go$internalize(v, go$funcType([go$sliceType(go$interfaceType([]))], [go$packages["github.com/neelance/gopherjs/js"].Object], true));
		case Number:
			return new Go$Float64(parseFloat(v));
		case Object:
			var mapType = go$mapType(Go$String, go$interfaceType([]));
			return new mapType(go$internalize(v, mapType));
		case String:
			return new Go$String(go$internalize(v, Go$String));
		}
		return v;
	case "Map":
		var m = new Go$Map();
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i += 1) {
			var key = go$internalize(keys[i], t.key);
			m[key.go$key ? key.go$key() : key] = { k: key, v: go$internalize(v[keys[i]], t.elem) };
		}
		return m;
	case "Slice":
		return new t(go$mapArray(v, function(e) { return go$internalize(e, t.elem); }));
	case "String":
		v = String(v);
		var s = "", i;
		for (i = 0; i < v.length; i += 1) {
			s += go$encodeRune(v.charCodeAt(i));
		}
		return s;
	default:
		return v;
	}
};

var go$copySlice = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	if (dst.array.constructor !== Array && n !== 0) {
		dst.array.set(src.array.subarray(src.offset, src.offset + n), dst.offset);
		return n;
	}
	for (i = 0; i < n; i += 1) {
		dst.array[dst.offset + i] = src.array[src.offset + i];
	}
	return n;
};

var go$copyString = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	for (i = 0; i < n; i += 1) {
		dst.array[dst.offset + i] = src.charCodeAt(i);
	}
	return n;
};

var go$copyArray = function(dst, src) {
	var i;
	for (i = 0; i < src.length; i += 1) {
		dst[i] = src[i];
	}
};

var go$growSlice = function(slice, length) {
	var newCapacity = Math.max(length, slice.capacity < 1024 ? slice.capacity * 2 : Math.floor(slice.capacity * 5 / 4));

	var newArray;
	if (slice.array.constructor === Array) {
		newArray = slice.array;
		if (slice.offset !== 0 || newArray.length !== slice.offset + slice.capacity) {
			newArray = newArray.slice(slice.offset);
		}
		newArray.length = newCapacity;
	} else {
		newArray = new slice.array.constructor(newCapacity);
		newArray.set(slice.array.subarray(slice.offset))
	}

	var newSlice = new slice.constructor(newArray);
	newSlice.length = slice.length;
	newSlice.capacity = newCapacity;
	return newSlice;
};

var go$append = function(slice) {
	if (arguments.length === 1) {
		return slice;
	}

	var newLength = slice.length + arguments.length - 1;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length - 1, i;
	for (i = 1; i < arguments.length; i += 1) {
		array[leftOffset + i] = arguments[i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$appendSlice = function(slice, toAppend) {
	if (toAppend.length === 0) {
		return slice;
	}

	var newLength = slice.length + toAppend.length;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length, rightOffset = toAppend.offset, i;
	for (i = 0; i < toAppend.length; i += 1) {
		array[leftOffset + i] = toAppend.array[rightOffset + i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$panic = function(value) {
	var message;
	if (value.constructor === Go$String) {
		message = value.go$val;
	} else if (value.Error !== undefined) {
		message = value.Error();
	} else if (value.String !== undefined) {
		message = value.String();
	} else {
		message = value;
	}
	var err = new Error(message);
	err.go$panicValue = value;
	return err;
};
var go$notSupported = function(feature) {
	var err = new Error("not supported by GopherJS: " + feature + " (hint: the file optional.go.patch contains patches for core packages)");
	err.go$notSupported = feature;
	throw err;
};
var go$throwRuntimeError; // set by package "runtime"

var go$errorStack = [], go$jsErr = null;

var go$pushErr = function(err) {
	if (err.go$panicValue === undefined) {
		go$jsErr = err;
		return;
	}
	go$errorStack.push({ frame: go$getStackDepth() - 1, error: err });
};

var go$callDeferred = function(deferred) {
	if (go$jsErr !== null) {
		throw go$jsErr; // JavaScript errors can not be rescued
	}
	var i;
	for (i = deferred.length - 1; i >= 0; i -= 1) {
		var call = deferred[i];
		try {
			if (call.recv !== undefined) {
				call.recv[call.method].apply(call.recv, call.args);
				continue;
			}
			call.fun.apply(undefined, call.args);
		} catch (err) {
			go$errorStack.push({ frame: go$getStackDepth(), error: err });
		}
	}
	var err = go$errorStack[go$errorStack.length - 1];
	if (err !== undefined && err.frame === go$getStackDepth()) {
		go$errorStack.pop();
		throw err.error;
	}
};

var go$recover = function() {
	var err = go$errorStack[go$errorStack.length - 1];
	if (err === undefined || err.frame !== go$getStackDepth() - 2) {
		return null;
	}
	go$errorStack.pop();
	return err.error.go$panicValue;
};

var go$getStack = function() {
	return (new Error()).stack.split("\n");
};

var go$getStackDepth = function() {
	var s = go$getStack(), d = 0, i;
	for (i = 0; i < s.length; i += 1) {
		if (s[i].indexOf("go$callDeferred") == -1) {
			d += 1;
		}
	}
	return d;
};

var go$interfaceIsEqual = function(a, b) {
	if (a === null || b === null) {
		return a === null && b === null;
	}
	if (a.constructor !== b.constructor) {
		return false;
	}
	switch (a.constructor.kind) {
	case "Float32":
		return go$float32bits(a.go$val) === go$float32bits(b.go$val);
	case "Complex64":
		return go$float32bits(a.go$val.real) === go$float32bits(b.go$val.real) && go$float32bits(a.go$val.imag) === go$float32bits(b.go$val.imag);
	case "Complex128":
		return a.go$val.real === b.go$val.real && a.go$val.imag === b.go$val.imag;
	case "Int64":
	case "Uint64":
		return a.go$val.high === b.go$val.high && a.go$val.low === b.go$val.low;
	case "Array":
		return go$arrayIsEqual(a.go$val, b.go$val);
	case "Ptr":
		if (a.constructor.Struct) {
			return a === b;
		}
		return go$pointerIsEqual(a, b);
	case "Func":
	case "Map":
	case "Slice":
	case "Struct":
		go$throwRuntimeError("comparing uncomparable type " + a.constructor);
	case undefined: // js.Object
		return a === b;
	default:
		return a.go$val === b.go$val;
	}
};
var go$arrayIsEqual = function(a, b) {
	if (a.length != b.length) {
		return false;
	}
	var i;
	for (i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
};
var go$sliceIsEqual = function(a, ai, b, bi) {
	return a.array === b.array && a.offset + ai === b.offset + bi;
};
var go$pointerIsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a.go$get === go$throwNilPointerError || b.go$get === go$throwNilPointerError) {
		return a.go$get === go$throwNilPointerError && b.go$get === go$throwNilPointerError;
	}
	var old = a.go$get();
	var dummy = new Object();
	a.go$set(dummy);
	var equal = b.go$get() === dummy;
	a.go$set(old);
	return equal;
};

var go$typeAssertionFailed = function(obj, expected) {
	var got = "nil";
	if (obj !== null) {
		got = obj.constructor.string;
	}
	throw go$panic("interface conversion: interface is " + got + ", not " + expected.string);
};

var go$now = function() { var msec = (new Date()).getTime(); return [new Go$Int64(0, Math.floor(msec / 1000)), (msec % 1000) * 1000000]; };

var go$packages = {};
go$packages["runtime"] = (function() {
  var go$pkg = {};
	var MemProfileRecord;
	MemProfileRecord = go$newType(0, "Struct", "runtime.MemProfileRecord", "MemProfileRecord", "runtime", function(AllocBytes_, FreeBytes_, AllocObjects_, FreeObjects_, Stack0_) {
		this.go$val = this;
		this.AllocBytes = AllocBytes_ !== undefined ? AllocBytes_ : new Go$Int64(0, 0);
		this.FreeBytes = FreeBytes_ !== undefined ? FreeBytes_ : new Go$Int64(0, 0);
		this.AllocObjects = AllocObjects_ !== undefined ? AllocObjects_ : new Go$Int64(0, 0);
		this.FreeObjects = FreeObjects_ !== undefined ? FreeObjects_ : new Go$Int64(0, 0);
		this.Stack0 = Stack0_ !== undefined ? Stack0_ : go$makeNativeArray("Uintptr", 32, function() { return 0; });
	});
	go$pkg.MemProfileRecord = MemProfileRecord;
	var StackRecord;
	StackRecord = go$newType(0, "Struct", "runtime.StackRecord", "StackRecord", "runtime", function(Stack0_) {
		this.go$val = this;
		this.Stack0 = Stack0_ !== undefined ? Stack0_ : go$makeNativeArray("Uintptr", 32, function() { return 0; });
	});
	go$pkg.StackRecord = StackRecord;
	var BlockProfileRecord;
	BlockProfileRecord = go$newType(0, "Struct", "runtime.BlockProfileRecord", "BlockProfileRecord", "runtime", function(Count_, Cycles_, StackRecord_) {
		this.go$val = this;
		this.Count = Count_ !== undefined ? Count_ : new Go$Int64(0, 0);
		this.Cycles = Cycles_ !== undefined ? Cycles_ : new Go$Int64(0, 0);
		this.StackRecord = StackRecord_ !== undefined ? StackRecord_ : new StackRecord.Ptr();
	});
	BlockProfileRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	BlockProfileRecord.Ptr.prototype.Stack = function() { return this.StackRecord.Stack(); };
	go$pkg.BlockProfileRecord = BlockProfileRecord;
	var Error;
	Error = go$newType(0, "Interface", "runtime.Error", "Error", "runtime", null);
	go$pkg.Error = Error;
	var TypeAssertionError;
	TypeAssertionError = go$newType(0, "Struct", "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.go$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	go$pkg.TypeAssertionError = TypeAssertionError;
	var errorString;
	errorString = go$newType(0, "String", "runtime.errorString", "errorString", "runtime", null);
	go$pkg.errorString = errorString;
	var errorCString;
	errorCString = go$newType(4, "Uintptr", "runtime.errorCString", "errorCString", "runtime", null);
	go$pkg.errorCString = errorCString;
	var stringer;
	stringer = go$newType(0, "Interface", "runtime.stringer", "stringer", "runtime", null);
	go$pkg.stringer = stringer;
	var Func;
	Func = go$newType(0, "Struct", "runtime.Func", "Func", "runtime", function(opaque_) {
		this.go$val = this;
		this.opaque = opaque_ !== undefined ? opaque_ : new (go$structType([])).Ptr();
	});
	go$pkg.Func = Func;
	var MemStats;
	MemStats = go$newType(0, "Struct", "runtime.MemStats", "MemStats", "runtime", function(Alloc_, TotalAlloc_, Sys_, Lookups_, Mallocs_, Frees_, HeapAlloc_, HeapSys_, HeapIdle_, HeapInuse_, HeapReleased_, HeapObjects_, StackInuse_, StackSys_, MSpanInuse_, MSpanSys_, MCacheInuse_, MCacheSys_, BuckHashSys_, GCSys_, OtherSys_, NextGC_, LastGC_, PauseTotalNs_, PauseNs_, NumGC_, EnableGC_, DebugGC_, BySize_) {
		this.go$val = this;
		this.Alloc = Alloc_ !== undefined ? Alloc_ : new Go$Uint64(0, 0);
		this.TotalAlloc = TotalAlloc_ !== undefined ? TotalAlloc_ : new Go$Uint64(0, 0);
		this.Sys = Sys_ !== undefined ? Sys_ : new Go$Uint64(0, 0);
		this.Lookups = Lookups_ !== undefined ? Lookups_ : new Go$Uint64(0, 0);
		this.Mallocs = Mallocs_ !== undefined ? Mallocs_ : new Go$Uint64(0, 0);
		this.Frees = Frees_ !== undefined ? Frees_ : new Go$Uint64(0, 0);
		this.HeapAlloc = HeapAlloc_ !== undefined ? HeapAlloc_ : new Go$Uint64(0, 0);
		this.HeapSys = HeapSys_ !== undefined ? HeapSys_ : new Go$Uint64(0, 0);
		this.HeapIdle = HeapIdle_ !== undefined ? HeapIdle_ : new Go$Uint64(0, 0);
		this.HeapInuse = HeapInuse_ !== undefined ? HeapInuse_ : new Go$Uint64(0, 0);
		this.HeapReleased = HeapReleased_ !== undefined ? HeapReleased_ : new Go$Uint64(0, 0);
		this.HeapObjects = HeapObjects_ !== undefined ? HeapObjects_ : new Go$Uint64(0, 0);
		this.StackInuse = StackInuse_ !== undefined ? StackInuse_ : new Go$Uint64(0, 0);
		this.StackSys = StackSys_ !== undefined ? StackSys_ : new Go$Uint64(0, 0);
		this.MSpanInuse = MSpanInuse_ !== undefined ? MSpanInuse_ : new Go$Uint64(0, 0);
		this.MSpanSys = MSpanSys_ !== undefined ? MSpanSys_ : new Go$Uint64(0, 0);
		this.MCacheInuse = MCacheInuse_ !== undefined ? MCacheInuse_ : new Go$Uint64(0, 0);
		this.MCacheSys = MCacheSys_ !== undefined ? MCacheSys_ : new Go$Uint64(0, 0);
		this.BuckHashSys = BuckHashSys_ !== undefined ? BuckHashSys_ : new Go$Uint64(0, 0);
		this.GCSys = GCSys_ !== undefined ? GCSys_ : new Go$Uint64(0, 0);
		this.OtherSys = OtherSys_ !== undefined ? OtherSys_ : new Go$Uint64(0, 0);
		this.NextGC = NextGC_ !== undefined ? NextGC_ : new Go$Uint64(0, 0);
		this.LastGC = LastGC_ !== undefined ? LastGC_ : new Go$Uint64(0, 0);
		this.PauseTotalNs = PauseTotalNs_ !== undefined ? PauseTotalNs_ : new Go$Uint64(0, 0);
		this.PauseNs = PauseNs_ !== undefined ? PauseNs_ : go$makeNativeArray("Uint64", 256, function() { return new Go$Uint64(0, 0); });
		this.NumGC = NumGC_ !== undefined ? NumGC_ : 0;
		this.EnableGC = EnableGC_ !== undefined ? EnableGC_ : false;
		this.DebugGC = DebugGC_ !== undefined ? DebugGC_ : false;
		this.BySize = BySize_ !== undefined ? BySize_ : go$makeNativeArray("Struct", 61, function() { return new (go$structType([["Size", "", Go$Uint32, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""]])).Ptr(0, new Go$Uint64(0, 0), new Go$Uint64(0, 0)); });
	});
	go$pkg.MemStats = MemStats;
	var rtype;
	rtype = go$newType(0, "Struct", "runtime.rtype", "rtype", "runtime", function(size_, hash_, _$2_, align_, fieldAlign_, kind_, alg_, gc_, string_, uncommonType_, ptrToThis_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : 0;
		this.hash = hash_ !== undefined ? hash_ : 0;
		this._$2 = _$2_ !== undefined ? _$2_ : 0;
		this.align = align_ !== undefined ? align_ : 0;
		this.fieldAlign = fieldAlign_ !== undefined ? fieldAlign_ : 0;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.alg = alg_ !== undefined ? alg_ : 0;
		this.gc = gc_ !== undefined ? gc_ : 0;
		this.string = string_ !== undefined ? string_ : (go$ptrType(Go$String)).nil;
		this.uncommonType = uncommonType_ !== undefined ? uncommonType_ : (go$ptrType(uncommonType)).nil;
		this.ptrToThis = ptrToThis_ !== undefined ? ptrToThis_ : (go$ptrType(rtype)).nil;
	});
	go$pkg.rtype = rtype;
	var _method;
	_method = go$newType(0, "Struct", "runtime._method", "_method", "runtime", function(name_, pkgPath_, mtyp_, typ_, ifn_, tfn_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.mtyp = mtyp_ !== undefined ? mtyp_ : (go$ptrType(rtype)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
		this.ifn = ifn_ !== undefined ? ifn_ : 0;
		this.tfn = tfn_ !== undefined ? tfn_ : 0;
	});
	go$pkg._method = _method;
	var uncommonType;
	uncommonType = go$newType(0, "Struct", "runtime.uncommonType", "uncommonType", "runtime", function(name_, pkgPath_, methods_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(_method)).nil;
	});
	go$pkg.uncommonType = uncommonType;
	var _imethod;
	_imethod = go$newType(0, "Struct", "runtime._imethod", "_imethod", "runtime", function(name_, pkgPath_, typ_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
	});
	go$pkg._imethod = _imethod;
	var interfaceType;
	interfaceType = go$newType(0, "Struct", "runtime.interfaceType", "interfaceType", "runtime", function(rtype_, methods_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(_imethod)).nil;
	});
	go$pkg.interfaceType = interfaceType;
	var lock;
	lock = go$newType(0, "Struct", "runtime.lock", "lock", "runtime", function(key_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : new Go$Uint64(0, 0);
	});
	go$pkg.lock = lock;
	var note;
	note = go$newType(0, "Struct", "runtime.note", "note", "runtime", function(key_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : new Go$Uint64(0, 0);
	});
	go$pkg.note = note;
	var _string;
	_string = go$newType(0, "Struct", "runtime._string", "_string", "runtime", function(str_, len_) {
		this.go$val = this;
		this.str = str_ !== undefined ? str_ : (go$ptrType(Go$Uint8)).nil;
		this.len = len_ !== undefined ? len_ : new Go$Int64(0, 0);
	});
	go$pkg._string = _string;
	var funcval;
	funcval = go$newType(0, "Struct", "runtime.funcval", "funcval", "runtime", function(fn_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
	});
	go$pkg.funcval = funcval;
	var iface;
	iface = go$newType(0, "Struct", "runtime.iface", "iface", "runtime", function(tab_, data_) {
		this.go$val = this;
		this.tab = tab_ !== undefined ? tab_ : (go$ptrType(itab)).nil;
		this.data = data_ !== undefined ? data_ : 0;
	});
	go$pkg.iface = iface;
	var eface;
	eface = go$newType(0, "Struct", "runtime.eface", "eface", "runtime", function(_type_, data_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
		this.data = data_ !== undefined ? data_ : 0;
	});
	go$pkg.eface = eface;
	var _complex64;
	_complex64 = go$newType(0, "Struct", "runtime._complex64", "_complex64", "runtime", function(real_, imag_) {
		this.go$val = this;
		this.real = real_ !== undefined ? real_ : 0;
		this.imag = imag_ !== undefined ? imag_ : 0;
	});
	go$pkg._complex64 = _complex64;
	var _complex128;
	_complex128 = go$newType(0, "Struct", "runtime._complex128", "_complex128", "runtime", function(real_, imag_) {
		this.go$val = this;
		this.real = real_ !== undefined ? real_ : 0;
		this.imag = imag_ !== undefined ? imag_ : 0;
	});
	go$pkg._complex128 = _complex128;
	var slice;
	slice = go$newType(0, "Struct", "runtime.slice", "slice", "runtime", function(array_, len_, cap_) {
		this.go$val = this;
		this.array = array_ !== undefined ? array_ : (go$ptrType(Go$Uint8)).nil;
		this.len = len_ !== undefined ? len_ : new Go$Uint64(0, 0);
		this.cap = cap_ !== undefined ? cap_ : new Go$Uint64(0, 0);
	});
	go$pkg.slice = slice;
	var gobuf;
	gobuf = go$newType(0, "Struct", "runtime.gobuf", "gobuf", "runtime", function(sp_, pc_, g_, ret_, ctxt_, lr_) {
		this.go$val = this;
		this.sp = sp_ !== undefined ? sp_ : new Go$Uint64(0, 0);
		this.pc = pc_ !== undefined ? pc_ : new Go$Uint64(0, 0);
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.ret = ret_ !== undefined ? ret_ : new Go$Uint64(0, 0);
		this.ctxt = ctxt_ !== undefined ? ctxt_ : 0;
		this.lr = lr_ !== undefined ? lr_ : new Go$Uint64(0, 0);
	});
	go$pkg.gobuf = gobuf;
	var gcstats;
	gcstats = go$newType(0, "Struct", "runtime.gcstats", "gcstats", "runtime", function(nhandoff_, nhandoffcnt_, nprocyield_, nosyield_, nsleep_) {
		this.go$val = this;
		this.nhandoff = nhandoff_ !== undefined ? nhandoff_ : new Go$Uint64(0, 0);
		this.nhandoffcnt = nhandoffcnt_ !== undefined ? nhandoffcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
	});
	go$pkg.gcstats = gcstats;
	var wincall;
	wincall = go$newType(0, "Struct", "runtime.wincall", "wincall", "runtime", function(fn_, n_, args_, r1_, r2_, err_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
		this.n = n_ !== undefined ? n_ : new Go$Uint64(0, 0);
		this.args = args_ !== undefined ? args_ : 0;
		this.r1 = r1_ !== undefined ? r1_ : new Go$Uint64(0, 0);
		this.r2 = r2_ !== undefined ? r2_ : new Go$Uint64(0, 0);
		this.err = err_ !== undefined ? err_ : new Go$Uint64(0, 0);
	});
	go$pkg.wincall = wincall;
	var seh;
	seh = go$newType(0, "Struct", "runtime.seh", "seh", "runtime", function(prev_, handler_) {
		this.go$val = this;
		this.prev = prev_ !== undefined ? prev_ : 0;
		this.handler = handler_ !== undefined ? handler_ : 0;
	});
	go$pkg.seh = seh;
	var wincallbackcontext;
	wincallbackcontext = go$newType(0, "Struct", "runtime.wincallbackcontext", "wincallbackcontext", "runtime", function(gobody_, argsize_, restorestack_) {
		this.go$val = this;
		this.gobody = gobody_ !== undefined ? gobody_ : 0;
		this.argsize = argsize_ !== undefined ? argsize_ : new Go$Uint64(0, 0);
		this.restorestack = restorestack_ !== undefined ? restorestack_ : new Go$Uint64(0, 0);
	});
	go$pkg.wincallbackcontext = wincallbackcontext;
	var g;
	g = go$newType(0, "Struct", "runtime.g", "g", "runtime", function(stackguard0_, stackbase_, panicwrap_, selgen_, _defer_, _panic_, sched_, syscallstack_, syscallsp_, syscallpc_, syscallguard_, stackguard_, stack0_, stacksize_, alllink_, param_, status_, goid_, waitreason_, schedlink_, ispanic_, issystem_, isbackground_, preempt_, raceignore_, m_, lockedm_, sig_, writenbuf_, writebuf_, dchunk_, dchunknext_, sigcode0_, sigcode1_, sigpc_, gopc_, racectx_, end_) {
		this.go$val = this;
		this.stackguard0 = stackguard0_ !== undefined ? stackguard0_ : new Go$Uint64(0, 0);
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.panicwrap = panicwrap_ !== undefined ? panicwrap_ : 0;
		this.selgen = selgen_ !== undefined ? selgen_ : 0;
		this._defer = _defer_ !== undefined ? _defer_ : (go$ptrType(_defer)).nil;
		this._panic = _panic_ !== undefined ? _panic_ : (go$ptrType(_panic)).nil;
		this.sched = sched_ !== undefined ? sched_ : new gobuf.Ptr();
		this.syscallstack = syscallstack_ !== undefined ? syscallstack_ : new Go$Uint64(0, 0);
		this.syscallsp = syscallsp_ !== undefined ? syscallsp_ : new Go$Uint64(0, 0);
		this.syscallpc = syscallpc_ !== undefined ? syscallpc_ : new Go$Uint64(0, 0);
		this.syscallguard = syscallguard_ !== undefined ? syscallguard_ : new Go$Uint64(0, 0);
		this.stackguard = stackguard_ !== undefined ? stackguard_ : new Go$Uint64(0, 0);
		this.stack0 = stack0_ !== undefined ? stack0_ : new Go$Uint64(0, 0);
		this.stacksize = stacksize_ !== undefined ? stacksize_ : new Go$Uint64(0, 0);
		this.alllink = alllink_ !== undefined ? alllink_ : (go$ptrType(g)).nil;
		this.param = param_ !== undefined ? param_ : 0;
		this.status = status_ !== undefined ? status_ : 0;
		this.goid = goid_ !== undefined ? goid_ : new Go$Int64(0, 0);
		this.waitreason = waitreason_ !== undefined ? waitreason_ : (go$ptrType(Go$Int8)).nil;
		this.schedlink = schedlink_ !== undefined ? schedlink_ : (go$ptrType(g)).nil;
		this.ispanic = ispanic_ !== undefined ? ispanic_ : 0;
		this.issystem = issystem_ !== undefined ? issystem_ : 0;
		this.isbackground = isbackground_ !== undefined ? isbackground_ : 0;
		this.preempt = preempt_ !== undefined ? preempt_ : 0;
		this.raceignore = raceignore_ !== undefined ? raceignore_ : 0;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.lockedm = lockedm_ !== undefined ? lockedm_ : (go$ptrType(m)).nil;
		this.sig = sig_ !== undefined ? sig_ : 0;
		this.writenbuf = writenbuf_ !== undefined ? writenbuf_ : 0;
		this.writebuf = writebuf_ !== undefined ? writebuf_ : (go$ptrType(Go$Uint8)).nil;
		this.dchunk = dchunk_ !== undefined ? dchunk_ : (go$ptrType(deferchunk)).nil;
		this.dchunknext = dchunknext_ !== undefined ? dchunknext_ : (go$ptrType(deferchunk)).nil;
		this.sigcode0 = sigcode0_ !== undefined ? sigcode0_ : new Go$Uint64(0, 0);
		this.sigcode1 = sigcode1_ !== undefined ? sigcode1_ : new Go$Uint64(0, 0);
		this.sigpc = sigpc_ !== undefined ? sigpc_ : new Go$Uint64(0, 0);
		this.gopc = gopc_ !== undefined ? gopc_ : new Go$Uint64(0, 0);
		this.racectx = racectx_ !== undefined ? racectx_ : new Go$Uint64(0, 0);
		this.end = end_ !== undefined ? end_ : go$makeNativeArray("Uint64", 0, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.g = g;
	var m;
	m = go$newType(0, "Struct", "runtime.m", "m", "runtime", function(g0_, moreargp_, morebuf_, moreframesize_, moreargsize_, cret_, procid_, gsignal_, tls_, mstartfn_, curg_, caughtsig_, p_, nextp_, id_, mallocing_, throwing_, gcing_, locks_, dying_, profilehz_, helpgc_, spinning_, fastrand_, ncgocall_, ncgo_, cgomal_, park_, alllink_, schedlink_, machport_, mcache_, stackinuse_, stackcachepos_, stackcachecnt_, stackcache_, lockedg_, createstack_, freglo_, freghi_, fflag_, locked_, nextwaitm_, waitsema_, waitsemacount_, waitsemalock_, gcstats_, racecall_, needextram_, waitunlockf_, waitlock_, settype_buf_, settype_bufsize_, seh_, end_) {
		this.go$val = this;
		this.g0 = g0_ !== undefined ? g0_ : (go$ptrType(g)).nil;
		this.moreargp = moreargp_ !== undefined ? moreargp_ : 0;
		this.morebuf = morebuf_ !== undefined ? morebuf_ : new gobuf.Ptr();
		this.moreframesize = moreframesize_ !== undefined ? moreframesize_ : 0;
		this.moreargsize = moreargsize_ !== undefined ? moreargsize_ : 0;
		this.cret = cret_ !== undefined ? cret_ : new Go$Uint64(0, 0);
		this.procid = procid_ !== undefined ? procid_ : new Go$Uint64(0, 0);
		this.gsignal = gsignal_ !== undefined ? gsignal_ : (go$ptrType(g)).nil;
		this.tls = tls_ !== undefined ? tls_ : go$makeNativeArray("Uint64", 4, function() { return new Go$Uint64(0, 0); });
		this.mstartfn = mstartfn_ !== undefined ? mstartfn_ : go$throwNilPointerError;
		this.curg = curg_ !== undefined ? curg_ : (go$ptrType(g)).nil;
		this.caughtsig = caughtsig_ !== undefined ? caughtsig_ : (go$ptrType(g)).nil;
		this.p = p_ !== undefined ? p_ : (go$ptrType(p)).nil;
		this.nextp = nextp_ !== undefined ? nextp_ : (go$ptrType(p)).nil;
		this.id = id_ !== undefined ? id_ : 0;
		this.mallocing = mallocing_ !== undefined ? mallocing_ : 0;
		this.throwing = throwing_ !== undefined ? throwing_ : 0;
		this.gcing = gcing_ !== undefined ? gcing_ : 0;
		this.locks = locks_ !== undefined ? locks_ : 0;
		this.dying = dying_ !== undefined ? dying_ : 0;
		this.profilehz = profilehz_ !== undefined ? profilehz_ : 0;
		this.helpgc = helpgc_ !== undefined ? helpgc_ : 0;
		this.spinning = spinning_ !== undefined ? spinning_ : 0;
		this.fastrand = fastrand_ !== undefined ? fastrand_ : 0;
		this.ncgocall = ncgocall_ !== undefined ? ncgocall_ : new Go$Uint64(0, 0);
		this.ncgo = ncgo_ !== undefined ? ncgo_ : 0;
		this.cgomal = cgomal_ !== undefined ? cgomal_ : (go$ptrType(cgomal)).nil;
		this.park = park_ !== undefined ? park_ : new note.Ptr();
		this.alllink = alllink_ !== undefined ? alllink_ : (go$ptrType(m)).nil;
		this.schedlink = schedlink_ !== undefined ? schedlink_ : (go$ptrType(m)).nil;
		this.machport = machport_ !== undefined ? machport_ : 0;
		this.mcache = mcache_ !== undefined ? mcache_ : (go$ptrType(mcache)).nil;
		this.stackinuse = stackinuse_ !== undefined ? stackinuse_ : 0;
		this.stackcachepos = stackcachepos_ !== undefined ? stackcachepos_ : 0;
		this.stackcachecnt = stackcachecnt_ !== undefined ? stackcachecnt_ : 0;
		this.stackcache = stackcache_ !== undefined ? stackcache_ : go$makeNativeArray("UnsafePointer", 32, function() { return 0; });
		this.lockedg = lockedg_ !== undefined ? lockedg_ : (go$ptrType(g)).nil;
		this.createstack = createstack_ !== undefined ? createstack_ : go$makeNativeArray("Uint64", 32, function() { return new Go$Uint64(0, 0); });
		this.freglo = freglo_ !== undefined ? freglo_ : go$makeNativeArray("Uint32", 16, function() { return 0; });
		this.freghi = freghi_ !== undefined ? freghi_ : go$makeNativeArray("Uint32", 16, function() { return 0; });
		this.fflag = fflag_ !== undefined ? fflag_ : 0;
		this.locked = locked_ !== undefined ? locked_ : 0;
		this.nextwaitm = nextwaitm_ !== undefined ? nextwaitm_ : (go$ptrType(m)).nil;
		this.waitsema = waitsema_ !== undefined ? waitsema_ : new Go$Uint64(0, 0);
		this.waitsemacount = waitsemacount_ !== undefined ? waitsemacount_ : 0;
		this.waitsemalock = waitsemalock_ !== undefined ? waitsemalock_ : 0;
		this.gcstats = gcstats_ !== undefined ? gcstats_ : new gcstats.Ptr();
		this.racecall = racecall_ !== undefined ? racecall_ : 0;
		this.needextram = needextram_ !== undefined ? needextram_ : 0;
		this.waitunlockf = waitunlockf_ !== undefined ? waitunlockf_ : go$throwNilPointerError;
		this.waitlock = waitlock_ !== undefined ? waitlock_ : 0;
		this.settype_buf = settype_buf_ !== undefined ? settype_buf_ : go$makeNativeArray("Uint64", 1024, function() { return new Go$Uint64(0, 0); });
		this.settype_bufsize = settype_bufsize_ !== undefined ? settype_bufsize_ : new Go$Uint64(0, 0);
		this.seh = seh_ !== undefined ? seh_ : (go$ptrType(seh)).nil;
		this.end = end_ !== undefined ? end_ : go$makeNativeArray("Uint64", 0, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.m = m;
	var p;
	p = go$newType(0, "Struct", "runtime.p", "p", "runtime", function(lock_, id_, status_, link_, schedtick_, syscalltick_, m_, mcache_, runq_, runqhead_, runqtail_, runqsize_, gfree_, gfreecnt_, pad_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.id = id_ !== undefined ? id_ : 0;
		this.status = status_ !== undefined ? status_ : 0;
		this.link = link_ !== undefined ? link_ : (go$ptrType(p)).nil;
		this.schedtick = schedtick_ !== undefined ? schedtick_ : 0;
		this.syscalltick = syscalltick_ !== undefined ? syscalltick_ : 0;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.mcache = mcache_ !== undefined ? mcache_ : (go$ptrType(mcache)).nil;
		this.runq = runq_ !== undefined ? runq_ : (go$ptrType((go$ptrType(g)))).nil;
		this.runqhead = runqhead_ !== undefined ? runqhead_ : 0;
		this.runqtail = runqtail_ !== undefined ? runqtail_ : 0;
		this.runqsize = runqsize_ !== undefined ? runqsize_ : 0;
		this.gfree = gfree_ !== undefined ? gfree_ : (go$ptrType(g)).nil;
		this.gfreecnt = gfreecnt_ !== undefined ? gfreecnt_ : 0;
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg.p = p;
	var stktop;
	stktop = go$newType(0, "Struct", "runtime.stktop", "stktop", "runtime", function(stackguard_, stackbase_, gobuf_, argsize_, panicwrap_, argp_, free_, _panic_) {
		this.go$val = this;
		this.stackguard = stackguard_ !== undefined ? stackguard_ : new Go$Uint64(0, 0);
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.gobuf = gobuf_ !== undefined ? gobuf_ : new gobuf.Ptr();
		this.argsize = argsize_ !== undefined ? argsize_ : 0;
		this.panicwrap = panicwrap_ !== undefined ? panicwrap_ : 0;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.free = free_ !== undefined ? free_ : new Go$Uint64(0, 0);
		this._panic = _panic_ !== undefined ? _panic_ : 0;
	});
	go$pkg.stktop = stktop;
	var sigtab;
	sigtab = go$newType(0, "Struct", "runtime.sigtab", "sigtab", "runtime", function(flags_, name_) {
		this.go$val = this;
		this.flags = flags_ !== undefined ? flags_ : 0;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$Int8)).nil;
	});
	go$pkg.sigtab = sigtab;
	var _func;
	_func = go$newType(0, "Struct", "runtime._func", "_func", "runtime", function(entry_, nameoff_, args_, frame_, pcsp_, pcfile_, pcln_, npcdata_, nfuncdata_) {
		this.go$val = this;
		this.entry = entry_ !== undefined ? entry_ : new Go$Uint64(0, 0);
		this.nameoff = nameoff_ !== undefined ? nameoff_ : 0;
		this.args = args_ !== undefined ? args_ : 0;
		this.frame = frame_ !== undefined ? frame_ : 0;
		this.pcsp = pcsp_ !== undefined ? pcsp_ : 0;
		this.pcfile = pcfile_ !== undefined ? pcfile_ : 0;
		this.pcln = pcln_ !== undefined ? pcln_ : 0;
		this.npcdata = npcdata_ !== undefined ? npcdata_ : 0;
		this.nfuncdata = nfuncdata_ !== undefined ? nfuncdata_ : 0;
	});
	go$pkg._func = _func;
	var itab;
	itab = go$newType(0, "Struct", "runtime.itab", "itab", "runtime", function(inter_, _type_, link_, bad_, unused_, fun_) {
		this.go$val = this;
		this.inter = inter_ !== undefined ? inter_ : (go$ptrType(interfacetype)).nil;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
		this.link = link_ !== undefined ? link_ : (go$ptrType(itab)).nil;
		this.bad = bad_ !== undefined ? bad_ : 0;
		this.unused = unused_ !== undefined ? unused_ : 0;
		this.fun = fun_ !== undefined ? fun_ : go$makeNativeArray("Func", 0, function() { return go$throwNilPointerError; });
	});
	go$pkg.itab = itab;
	var timers;
	timers = go$newType(0, "Struct", "runtime.timers", "timers", "runtime", function(lock_, timerproc_, sleeping_, rescheduling_, waitnote_, t_, len_, cap_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.timerproc = timerproc_ !== undefined ? timerproc_ : (go$ptrType(g)).nil;
		this.sleeping = sleeping_ !== undefined ? sleeping_ : 0;
		this.rescheduling = rescheduling_ !== undefined ? rescheduling_ : 0;
		this.waitnote = waitnote_ !== undefined ? waitnote_ : new note.Ptr();
		this.t = t_ !== undefined ? t_ : (go$ptrType((go$ptrType(timer)))).nil;
		this.len = len_ !== undefined ? len_ : 0;
		this.cap = cap_ !== undefined ? cap_ : 0;
	});
	go$pkg.timers = timers;
	var timer;
	timer = go$newType(0, "Struct", "runtime.timer", "timer", "runtime", function(i_, when_, period_, fv_, arg_) {
		this.go$val = this;
		this.i = i_ !== undefined ? i_ : 0;
		this.when = when_ !== undefined ? when_ : new Go$Int64(0, 0);
		this.period = period_ !== undefined ? period_ : new Go$Int64(0, 0);
		this.fv = fv_ !== undefined ? fv_ : (go$ptrType(funcval)).nil;
		this.arg = arg_ !== undefined ? arg_ : new eface.Ptr();
	});
	go$pkg.timer = timer;
	var lfnode;
	lfnode = go$newType(0, "Struct", "runtime.lfnode", "lfnode", "runtime", function(next_, pushcnt_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(lfnode)).nil;
		this.pushcnt = pushcnt_ !== undefined ? pushcnt_ : new Go$Uint64(0, 0);
	});
	go$pkg.lfnode = lfnode;
	var parfor;
	parfor = go$newType(0, "Struct", "runtime.parfor", "parfor", "runtime", function(body_, done_, nthr_, nthrmax_, thrseq_, cnt_, ctx_, wait_, thr_, pad_, nsteal_, nstealcnt_, nprocyield_, nosyield_, nsleep_) {
		this.go$val = this;
		this.body = body_ !== undefined ? body_ : go$throwNilPointerError;
		this.done = done_ !== undefined ? done_ : 0;
		this.nthr = nthr_ !== undefined ? nthr_ : 0;
		this.nthrmax = nthrmax_ !== undefined ? nthrmax_ : 0;
		this.thrseq = thrseq_ !== undefined ? thrseq_ : 0;
		this.cnt = cnt_ !== undefined ? cnt_ : 0;
		this.ctx = ctx_ !== undefined ? ctx_ : 0;
		this.wait = wait_ !== undefined ? wait_ : 0;
		this.thr = thr_ !== undefined ? thr_ : (go$ptrType(parforthread)).nil;
		this.pad = pad_ !== undefined ? pad_ : 0;
		this.nsteal = nsteal_ !== undefined ? nsteal_ : new Go$Uint64(0, 0);
		this.nstealcnt = nstealcnt_ !== undefined ? nstealcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
	});
	go$pkg.parfor = parfor;
	var cgomal;
	cgomal = go$newType(0, "Struct", "runtime.cgomal", "cgomal", "runtime", function(next_, alloc_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(cgomal)).nil;
		this.alloc = alloc_ !== undefined ? alloc_ : 0;
	});
	go$pkg.cgomal = cgomal;
	var debugvars;
	debugvars = go$newType(0, "Struct", "runtime.debugvars", "debugvars", "runtime", function(gctrace_, schedtrace_, scheddetail_) {
		this.go$val = this;
		this.gctrace = gctrace_ !== undefined ? gctrace_ : 0;
		this.schedtrace = schedtrace_ !== undefined ? schedtrace_ : 0;
		this.scheddetail = scheddetail_ !== undefined ? scheddetail_ : 0;
	});
	go$pkg.debugvars = debugvars;
	var alg;
	alg = go$newType(0, "Struct", "runtime.alg", "alg", "runtime", function(hash_, equal_, print_, copy_) {
		this.go$val = this;
		this.hash = hash_ !== undefined ? hash_ : go$throwNilPointerError;
		this.equal = equal_ !== undefined ? equal_ : go$throwNilPointerError;
		this.print = print_ !== undefined ? print_ : go$throwNilPointerError;
		this.copy = copy_ !== undefined ? copy_ : go$throwNilPointerError;
	});
	go$pkg.alg = alg;
	var _defer;
	_defer = go$newType(0, "Struct", "runtime._defer", "_defer", "runtime", function(siz_, special_, free_, argp_, pc_, fn_, link_, args_) {
		this.go$val = this;
		this.siz = siz_ !== undefined ? siz_ : 0;
		this.special = special_ !== undefined ? special_ : 0;
		this.free = free_ !== undefined ? free_ : 0;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.pc = pc_ !== undefined ? pc_ : (go$ptrType(Go$Uint8)).nil;
		this.fn = fn_ !== undefined ? fn_ : (go$ptrType(funcval)).nil;
		this.link = link_ !== undefined ? link_ : (go$ptrType(_defer)).nil;
		this.args = args_ !== undefined ? args_ : go$makeNativeArray("UnsafePointer", 1, function() { return 0; });
	});
	go$pkg._defer = _defer;
	var deferchunk;
	deferchunk = go$newType(0, "Struct", "runtime.deferchunk", "deferchunk", "runtime", function(prev_, off_) {
		this.go$val = this;
		this.prev = prev_ !== undefined ? prev_ : (go$ptrType(deferchunk)).nil;
		this.off = off_ !== undefined ? off_ : new Go$Uint64(0, 0);
	});
	go$pkg.deferchunk = deferchunk;
	var _panic;
	_panic = go$newType(0, "Struct", "runtime._panic", "_panic", "runtime", function(arg_, stackbase_, link_, recovered_) {
		this.go$val = this;
		this.arg = arg_ !== undefined ? arg_ : new eface.Ptr();
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.link = link_ !== undefined ? link_ : (go$ptrType(_panic)).nil;
		this.recovered = recovered_ !== undefined ? recovered_ : 0;
	});
	go$pkg._panic = _panic;
	var stkframe;
	stkframe = go$newType(0, "Struct", "runtime.stkframe", "stkframe", "runtime", function(fn_, pc_, lr_, sp_, fp_, varp_, argp_, arglen_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : (go$ptrType(_func)).nil;
		this.pc = pc_ !== undefined ? pc_ : new Go$Uint64(0, 0);
		this.lr = lr_ !== undefined ? lr_ : new Go$Uint64(0, 0);
		this.sp = sp_ !== undefined ? sp_ : new Go$Uint64(0, 0);
		this.fp = fp_ !== undefined ? fp_ : new Go$Uint64(0, 0);
		this.varp = varp_ !== undefined ? varp_ : (go$ptrType(Go$Uint8)).nil;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.arglen = arglen_ !== undefined ? arglen_ : new Go$Uint64(0, 0);
	});
	go$pkg.stkframe = stkframe;
	var mlink;
	mlink = go$newType(0, "Struct", "runtime.mlink", "mlink", "runtime", function(next_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(mlink)).nil;
	});
	go$pkg.mlink = mlink;
	var fixalloc;
	fixalloc = go$newType(0, "Struct", "runtime.fixalloc", "fixalloc", "runtime", function(size_, first_, arg_, list_, chunk_, nchunk_, inuse_, stat_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : new Go$Uint64(0, 0);
		this.first = first_ !== undefined ? first_ : go$throwNilPointerError;
		this.arg = arg_ !== undefined ? arg_ : 0;
		this.list = list_ !== undefined ? list_ : (go$ptrType(mlink)).nil;
		this.chunk = chunk_ !== undefined ? chunk_ : (go$ptrType(Go$Uint8)).nil;
		this.nchunk = nchunk_ !== undefined ? nchunk_ : 0;
		this.inuse = inuse_ !== undefined ? inuse_ : new Go$Uint64(0, 0);
		this.stat = stat_ !== undefined ? stat_ : (go$ptrType(Go$Uint64)).nil;
	});
	go$pkg.fixalloc = fixalloc;
	var _1_;
	_1_ = go$newType(0, "Struct", "runtime._1_", "_1_", "runtime", function(size_, nmalloc_, nfree_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : 0;
		this.nmalloc = nmalloc_ !== undefined ? nmalloc_ : new Go$Uint64(0, 0);
		this.nfree = nfree_ !== undefined ? nfree_ : new Go$Uint64(0, 0);
	});
	go$pkg._1_ = _1_;
	var mstats;
	mstats = go$newType(0, "Struct", "runtime.mstats", "mstats", "runtime", function(alloc_, total_alloc_, sys_, nlookup_, nmalloc_, nfree_, heap_alloc_, heap_sys_, heap_idle_, heap_inuse_, heap_released_, heap_objects_, stacks_inuse_, stacks_sys_, mspan_inuse_, mspan_sys_, mcache_inuse_, mcache_sys_, buckhash_sys_, gc_sys_, other_sys_, next_gc_, last_gc_, pause_total_ns_, pause_ns_, numgc_, enablegc_, debuggc_, by_size_) {
		this.go$val = this;
		this.alloc = alloc_ !== undefined ? alloc_ : new Go$Uint64(0, 0);
		this.total_alloc = total_alloc_ !== undefined ? total_alloc_ : new Go$Uint64(0, 0);
		this.sys = sys_ !== undefined ? sys_ : new Go$Uint64(0, 0);
		this.nlookup = nlookup_ !== undefined ? nlookup_ : new Go$Uint64(0, 0);
		this.nmalloc = nmalloc_ !== undefined ? nmalloc_ : new Go$Uint64(0, 0);
		this.nfree = nfree_ !== undefined ? nfree_ : new Go$Uint64(0, 0);
		this.heap_alloc = heap_alloc_ !== undefined ? heap_alloc_ : new Go$Uint64(0, 0);
		this.heap_sys = heap_sys_ !== undefined ? heap_sys_ : new Go$Uint64(0, 0);
		this.heap_idle = heap_idle_ !== undefined ? heap_idle_ : new Go$Uint64(0, 0);
		this.heap_inuse = heap_inuse_ !== undefined ? heap_inuse_ : new Go$Uint64(0, 0);
		this.heap_released = heap_released_ !== undefined ? heap_released_ : new Go$Uint64(0, 0);
		this.heap_objects = heap_objects_ !== undefined ? heap_objects_ : new Go$Uint64(0, 0);
		this.stacks_inuse = stacks_inuse_ !== undefined ? stacks_inuse_ : new Go$Uint64(0, 0);
		this.stacks_sys = stacks_sys_ !== undefined ? stacks_sys_ : new Go$Uint64(0, 0);
		this.mspan_inuse = mspan_inuse_ !== undefined ? mspan_inuse_ : new Go$Uint64(0, 0);
		this.mspan_sys = mspan_sys_ !== undefined ? mspan_sys_ : new Go$Uint64(0, 0);
		this.mcache_inuse = mcache_inuse_ !== undefined ? mcache_inuse_ : new Go$Uint64(0, 0);
		this.mcache_sys = mcache_sys_ !== undefined ? mcache_sys_ : new Go$Uint64(0, 0);
		this.buckhash_sys = buckhash_sys_ !== undefined ? buckhash_sys_ : new Go$Uint64(0, 0);
		this.gc_sys = gc_sys_ !== undefined ? gc_sys_ : new Go$Uint64(0, 0);
		this.other_sys = other_sys_ !== undefined ? other_sys_ : new Go$Uint64(0, 0);
		this.next_gc = next_gc_ !== undefined ? next_gc_ : new Go$Uint64(0, 0);
		this.last_gc = last_gc_ !== undefined ? last_gc_ : new Go$Uint64(0, 0);
		this.pause_total_ns = pause_total_ns_ !== undefined ? pause_total_ns_ : new Go$Uint64(0, 0);
		this.pause_ns = pause_ns_ !== undefined ? pause_ns_ : go$makeNativeArray("Uint64", 256, function() { return new Go$Uint64(0, 0); });
		this.numgc = numgc_ !== undefined ? numgc_ : 0;
		this.enablegc = enablegc_ !== undefined ? enablegc_ : 0;
		this.debuggc = debuggc_ !== undefined ? debuggc_ : 0;
		this.by_size = by_size_ !== undefined ? by_size_ : go$makeNativeArray("Struct", 61, function() { return new _1_.Ptr(); });
	});
	go$pkg.mstats = mstats;
	var mcachelist;
	mcachelist = go$newType(0, "Struct", "runtime.mcachelist", "mcachelist", "runtime", function(list_, nlist_) {
		this.go$val = this;
		this.list = list_ !== undefined ? list_ : (go$ptrType(mlink)).nil;
		this.nlist = nlist_ !== undefined ? nlist_ : 0;
	});
	go$pkg.mcachelist = mcachelist;
	var mcache;
	mcache = go$newType(0, "Struct", "runtime.mcache", "mcache", "runtime", function(next_sample_, local_cachealloc_, list_, local_nlookup_, local_largefree_, local_nlargefree_, local_nsmallfree_) {
		this.go$val = this;
		this.next_sample = next_sample_ !== undefined ? next_sample_ : 0;
		this.local_cachealloc = local_cachealloc_ !== undefined ? local_cachealloc_ : new Go$Int64(0, 0);
		this.list = list_ !== undefined ? list_ : go$makeNativeArray("Struct", 61, function() { return new mcachelist.Ptr(); });
		this.local_nlookup = local_nlookup_ !== undefined ? local_nlookup_ : new Go$Uint64(0, 0);
		this.local_largefree = local_largefree_ !== undefined ? local_largefree_ : new Go$Uint64(0, 0);
		this.local_nlargefree = local_nlargefree_ !== undefined ? local_nlargefree_ : new Go$Uint64(0, 0);
		this.local_nsmallfree = local_nsmallfree_ !== undefined ? local_nsmallfree_ : go$makeNativeArray("Uint64", 61, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.mcache = mcache;
	var mtypes;
	mtypes = go$newType(0, "Struct", "runtime.mtypes", "mtypes", "runtime", function(compression_, data_) {
		this.go$val = this;
		this.compression = compression_ !== undefined ? compression_ : 0;
		this.data = data_ !== undefined ? data_ : new Go$Uint64(0, 0);
	});
	go$pkg.mtypes = mtypes;
	var mspan;
	mspan = go$newType(0, "Struct", "runtime.mspan", "mspan", "runtime", function(next_, prev_, start_, npages_, freelist_, ref_, sizeclass_, elemsize_, state_, unusedsince_, npreleased_, limit_, types_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(mspan)).nil;
		this.prev = prev_ !== undefined ? prev_ : (go$ptrType(mspan)).nil;
		this.start = start_ !== undefined ? start_ : new Go$Uint64(0, 0);
		this.npages = npages_ !== undefined ? npages_ : new Go$Uint64(0, 0);
		this.freelist = freelist_ !== undefined ? freelist_ : (go$ptrType(mlink)).nil;
		this.ref = ref_ !== undefined ? ref_ : 0;
		this.sizeclass = sizeclass_ !== undefined ? sizeclass_ : 0;
		this.elemsize = elemsize_ !== undefined ? elemsize_ : new Go$Uint64(0, 0);
		this.state = state_ !== undefined ? state_ : 0;
		this.unusedsince = unusedsince_ !== undefined ? unusedsince_ : new Go$Int64(0, 0);
		this.npreleased = npreleased_ !== undefined ? npreleased_ : new Go$Uint64(0, 0);
		this.limit = limit_ !== undefined ? limit_ : (go$ptrType(Go$Uint8)).nil;
		this.types = types_ !== undefined ? types_ : new mtypes.Ptr();
	});
	go$pkg.mspan = mspan;
	var mcentral;
	mcentral = go$newType(0, "Struct", "runtime.mcentral", "mcentral", "runtime", function(lock_, sizeclass_, nonempty_, empty_, nfree_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.sizeclass = sizeclass_ !== undefined ? sizeclass_ : 0;
		this.nonempty = nonempty_ !== undefined ? nonempty_ : new mspan.Ptr();
		this.empty = empty_ !== undefined ? empty_ : new mspan.Ptr();
		this.nfree = nfree_ !== undefined ? nfree_ : 0;
	});
	go$pkg.mcentral = mcentral;
	var _2_;
	_2_ = go$newType(0, "Struct", "runtime._2_", "_2_", "runtime", function(mcentral_, pad_) {
		this.go$val = this;
		this.mcentral = mcentral_ !== undefined ? mcentral_ : new mcentral.Ptr();
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg._2_ = _2_;
	var mheap;
	mheap = go$newType(0, "Struct", "runtime.mheap", "mheap", "runtime", function(lock_, free_, large_, allspans_, nspan_, nspancap_, spans_, spans_mapped_, bitmap_, bitmap_mapped_, arena_start_, arena_used_, arena_end_, central_, spanalloc_, cachealloc_, largefree_, nlargefree_, nsmallfree_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.free = free_ !== undefined ? free_ : go$makeNativeArray("Struct", 256, function() { return new mspan.Ptr(); });
		this.large = large_ !== undefined ? large_ : new mspan.Ptr();
		this.allspans = allspans_ !== undefined ? allspans_ : (go$ptrType((go$ptrType(mspan)))).nil;
		this.nspan = nspan_ !== undefined ? nspan_ : 0;
		this.nspancap = nspancap_ !== undefined ? nspancap_ : 0;
		this.spans = spans_ !== undefined ? spans_ : (go$ptrType((go$ptrType(mspan)))).nil;
		this.spans_mapped = spans_mapped_ !== undefined ? spans_mapped_ : new Go$Uint64(0, 0);
		this.bitmap = bitmap_ !== undefined ? bitmap_ : (go$ptrType(Go$Uint8)).nil;
		this.bitmap_mapped = bitmap_mapped_ !== undefined ? bitmap_mapped_ : new Go$Uint64(0, 0);
		this.arena_start = arena_start_ !== undefined ? arena_start_ : (go$ptrType(Go$Uint8)).nil;
		this.arena_used = arena_used_ !== undefined ? arena_used_ : (go$ptrType(Go$Uint8)).nil;
		this.arena_end = arena_end_ !== undefined ? arena_end_ : (go$ptrType(Go$Uint8)).nil;
		this.central = central_ !== undefined ? central_ : go$makeNativeArray("Struct", 61, function() { return new _2_.Ptr(); });
		this.spanalloc = spanalloc_ !== undefined ? spanalloc_ : new fixalloc.Ptr();
		this.cachealloc = cachealloc_ !== undefined ? cachealloc_ : new fixalloc.Ptr();
		this.largefree = largefree_ !== undefined ? largefree_ : new Go$Uint64(0, 0);
		this.nlargefree = nlargefree_ !== undefined ? nlargefree_ : new Go$Uint64(0, 0);
		this.nsmallfree = nsmallfree_ !== undefined ? nsmallfree_ : go$makeNativeArray("Uint64", 61, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.mheap = mheap;
	var _type;
	_type = go$newType(0, "Struct", "runtime._type", "_type", "runtime", function(size_, hash_, _unused_, align_, fieldalign_, kind_, alg_, gc_, _string_, x_, ptrto_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : new Go$Uint64(0, 0);
		this.hash = hash_ !== undefined ? hash_ : 0;
		this._unused = _unused_ !== undefined ? _unused_ : 0;
		this.align = align_ !== undefined ? align_ : 0;
		this.fieldalign = fieldalign_ !== undefined ? fieldalign_ : 0;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.alg = alg_ !== undefined ? alg_ : (go$ptrType(alg)).nil;
		this.gc = gc_ !== undefined ? gc_ : 0;
		this._string = _string_ !== undefined ? _string_ : (go$ptrType(Go$String)).nil;
		this.x = x_ !== undefined ? x_ : (go$ptrType(uncommontype)).nil;
		this.ptrto = ptrto_ !== undefined ? ptrto_ : (go$ptrType(_type)).nil;
	});
	go$pkg._type = _type;
	var method;
	method = go$newType(0, "Struct", "runtime.method", "method", "runtime", function(name_, pkgpath_, mtyp_, typ_, ifn_, tfn_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this.mtyp = mtyp_ !== undefined ? mtyp_ : (go$ptrType(_type)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(_type)).nil;
		this.ifn = ifn_ !== undefined ? ifn_ : go$throwNilPointerError;
		this.tfn = tfn_ !== undefined ? tfn_ : go$throwNilPointerError;
	});
	go$pkg.method = method;
	var uncommontype;
	uncommontype = go$newType(0, "Struct", "runtime.uncommontype", "uncommontype", "runtime", function(name_, pkgpath_, mhdr_, m_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this.mhdr = mhdr_ !== undefined ? mhdr_ : (go$sliceType(Go$Uint8)).nil;
		this.m = m_ !== undefined ? m_ : go$makeNativeArray("Struct", 0, function() { return new method.Ptr(); });
	});
	go$pkg.uncommontype = uncommontype;
	var imethod;
	imethod = go$newType(0, "Struct", "runtime.imethod", "imethod", "runtime", function(name_, pkgpath_, _type_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
	});
	go$pkg.imethod = imethod;
	var interfacetype;
	interfacetype = go$newType(0, "Struct", "runtime.interfacetype", "interfacetype", "runtime", function(_type_, mhdr_, m_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.mhdr = mhdr_ !== undefined ? mhdr_ : (go$sliceType(Go$Uint8)).nil;
		this.m = m_ !== undefined ? m_ : go$makeNativeArray("Struct", 0, function() { return new imethod.Ptr(); });
	});
	go$pkg.interfacetype = interfacetype;
	var maptype;
	maptype = go$newType(0, "Struct", "runtime.maptype", "maptype", "runtime", function(_type_, key_, elem_, bucket_, hmap_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.key = key_ !== undefined ? key_ : (go$ptrType(_type)).nil;
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
		this.bucket = bucket_ !== undefined ? bucket_ : (go$ptrType(_type)).nil;
		this.hmap = hmap_ !== undefined ? hmap_ : (go$ptrType(_type)).nil;
	});
	go$pkg.maptype = maptype;
	var chantype;
	chantype = go$newType(0, "Struct", "runtime.chantype", "chantype", "runtime", function(_type_, elem_, dir_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
		this.dir = dir_ !== undefined ? dir_ : new Go$Uint64(0, 0);
	});
	go$pkg.chantype = chantype;
	var slicetype;
	slicetype = go$newType(0, "Struct", "runtime.slicetype", "slicetype", "runtime", function(_type_, elem_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
	});
	go$pkg.slicetype = slicetype;
	var functype;
	functype = go$newType(0, "Struct", "runtime.functype", "functype", "runtime", function(_type_, dotdotdot_, in$2_, out_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.dotdotdot = dotdotdot_ !== undefined ? dotdotdot_ : 0;
		this.in$2 = in$2_ !== undefined ? in$2_ : (go$sliceType(Go$Uint8)).nil;
		this.out = out_ !== undefined ? out_ : (go$sliceType(Go$Uint8)).nil;
	});
	go$pkg.functype = functype;
	var ptrtype;
	ptrtype = go$newType(0, "Struct", "runtime.ptrtype", "ptrtype", "runtime", function(_type_, elem_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
	});
	go$pkg.ptrtype = ptrtype;
	var sched;
	sched = go$newType(0, "Struct", "runtime.sched", "sched", "runtime", function(lock_, goidgen_, midle_, nmidle_, nmidlelocked_, mcount_, maxmcount_, pidle_, npidle_, nmspinning_, runqhead_, runqtail_, runqsize_, gflock_, gfree_, gcwaiting_, stopwait_, stopnote_, sysmonwait_, sysmonnote_, lastpoll_, profilehz_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.goidgen = goidgen_ !== undefined ? goidgen_ : new Go$Uint64(0, 0);
		this.midle = midle_ !== undefined ? midle_ : (go$ptrType(m)).nil;
		this.nmidle = nmidle_ !== undefined ? nmidle_ : 0;
		this.nmidlelocked = nmidlelocked_ !== undefined ? nmidlelocked_ : 0;
		this.mcount = mcount_ !== undefined ? mcount_ : 0;
		this.maxmcount = maxmcount_ !== undefined ? maxmcount_ : 0;
		this.pidle = pidle_ !== undefined ? pidle_ : (go$ptrType(p)).nil;
		this.npidle = npidle_ !== undefined ? npidle_ : 0;
		this.nmspinning = nmspinning_ !== undefined ? nmspinning_ : 0;
		this.runqhead = runqhead_ !== undefined ? runqhead_ : (go$ptrType(g)).nil;
		this.runqtail = runqtail_ !== undefined ? runqtail_ : (go$ptrType(g)).nil;
		this.runqsize = runqsize_ !== undefined ? runqsize_ : 0;
		this.gflock = gflock_ !== undefined ? gflock_ : new lock.Ptr();
		this.gfree = gfree_ !== undefined ? gfree_ : (go$ptrType(g)).nil;
		this.gcwaiting = gcwaiting_ !== undefined ? gcwaiting_ : 0;
		this.stopwait = stopwait_ !== undefined ? stopwait_ : 0;
		this.stopnote = stopnote_ !== undefined ? stopnote_ : new note.Ptr();
		this.sysmonwait = sysmonwait_ !== undefined ? sysmonwait_ : 0;
		this.sysmonnote = sysmonnote_ !== undefined ? sysmonnote_ : new note.Ptr();
		this.lastpoll = lastpoll_ !== undefined ? lastpoll_ : new Go$Uint64(0, 0);
		this.profilehz = profilehz_ !== undefined ? profilehz_ : 0;
	});
	go$pkg.sched = sched;
	var cgothreadstart;
	cgothreadstart = go$newType(0, "Struct", "runtime.cgothreadstart", "cgothreadstart", "runtime", function(m_, g_, fn_) {
		this.go$val = this;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
	});
	go$pkg.cgothreadstart = cgothreadstart;
	var _3_;
	_3_ = go$newType(0, "Struct", "runtime._3_", "_3_", "runtime", function(lock_, fn_, hz_, pcbuf_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
		this.hz = hz_ !== undefined ? hz_ : 0;
		this.pcbuf = pcbuf_ !== undefined ? pcbuf_ : go$makeNativeArray("Uint64", 100, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg._3_ = _3_;
	var pdesc;
	pdesc = go$newType(0, "Struct", "runtime.pdesc", "pdesc", "runtime", function(schedtick_, schedwhen_, syscalltick_, syscallwhen_) {
		this.go$val = this;
		this.schedtick = schedtick_ !== undefined ? schedtick_ : 0;
		this.schedwhen = schedwhen_ !== undefined ? schedwhen_ : new Go$Int64(0, 0);
		this.syscalltick = syscalltick_ !== undefined ? syscalltick_ : 0;
		this.syscallwhen = syscallwhen_ !== undefined ? syscallwhen_ : new Go$Int64(0, 0);
	});
	go$pkg.pdesc = pdesc;
	var bucket;
	bucket = go$newType(0, "Struct", "runtime.bucket", "bucket", "runtime", function(tophash_, overflow_, data_) {
		this.go$val = this;
		this.tophash = tophash_ !== undefined ? tophash_ : go$makeNativeArray("Uint8", 8, function() { return 0; });
		this.overflow = overflow_ !== undefined ? overflow_ : (go$ptrType(bucket)).nil;
		this.data = data_ !== undefined ? data_ : go$makeNativeArray("Uint8", 1, function() { return 0; });
	});
	go$pkg.bucket = bucket;
	var hmap;
	hmap = go$newType(0, "Struct", "runtime.hmap", "hmap", "runtime", function(count_, flags_, hash0_, b_, keysize_, valuesize_, bucketsize_, buckets_, oldbuckets_, nevacuate_) {
		this.go$val = this;
		this.count = count_ !== undefined ? count_ : new Go$Uint64(0, 0);
		this.flags = flags_ !== undefined ? flags_ : 0;
		this.hash0 = hash0_ !== undefined ? hash0_ : 0;
		this.b = b_ !== undefined ? b_ : 0;
		this.keysize = keysize_ !== undefined ? keysize_ : 0;
		this.valuesize = valuesize_ !== undefined ? valuesize_ : 0;
		this.bucketsize = bucketsize_ !== undefined ? bucketsize_ : 0;
		this.buckets = buckets_ !== undefined ? buckets_ : (go$ptrType(Go$Uint8)).nil;
		this.oldbuckets = oldbuckets_ !== undefined ? oldbuckets_ : (go$ptrType(Go$Uint8)).nil;
		this.nevacuate = nevacuate_ !== undefined ? nevacuate_ : new Go$Uint64(0, 0);
	});
	go$pkg.hmap = hmap;
	var hash_iter;
	hash_iter = go$newType(0, "Struct", "runtime.hash_iter", "hash_iter", "runtime", function(key_, value_, t_, h_, endbucket_, wrapped_, b_, buckets_, bucket_, bptr_, i_, check_bucket_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : (go$ptrType(Go$Uint8)).nil;
		this.value = value_ !== undefined ? value_ : (go$ptrType(Go$Uint8)).nil;
		this.t = t_ !== undefined ? t_ : (go$ptrType(maptype)).nil;
		this.h = h_ !== undefined ? h_ : (go$ptrType(hmap)).nil;
		this.endbucket = endbucket_ !== undefined ? endbucket_ : new Go$Uint64(0, 0);
		this.wrapped = wrapped_ !== undefined ? wrapped_ : 0;
		this.b = b_ !== undefined ? b_ : 0;
		this.buckets = buckets_ !== undefined ? buckets_ : (go$ptrType(Go$Uint8)).nil;
		this.bucket = bucket_ !== undefined ? bucket_ : new Go$Uint64(0, 0);
		this.bptr = bptr_ !== undefined ? bptr_ : (go$ptrType(bucket)).nil;
		this.i = i_ !== undefined ? i_ : new Go$Uint64(0, 0);
		this.check_bucket = check_bucket_ !== undefined ? check_bucket_ : new Go$Int64(0, 0);
	});
	go$pkg.hash_iter = hash_iter;
	var sudog;
	sudog = go$newType(0, "Struct", "runtime.sudog", "sudog", "runtime", function(g_, selgen_, link_, releasetime_, elem_) {
		this.go$val = this;
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.selgen = selgen_ !== undefined ? selgen_ : 0;
		this.link = link_ !== undefined ? link_ : (go$ptrType(sudog)).nil;
		this.releasetime = releasetime_ !== undefined ? releasetime_ : new Go$Int64(0, 0);
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(Go$Uint8)).nil;
	});
	go$pkg.sudog = sudog;
	var waitq;
	waitq = go$newType(0, "Struct", "runtime.waitq", "waitq", "runtime", function(first_, last_) {
		this.go$val = this;
		this.first = first_ !== undefined ? first_ : (go$ptrType(sudog)).nil;
		this.last = last_ !== undefined ? last_ : (go$ptrType(sudog)).nil;
	});
	go$pkg.waitq = waitq;
	var hchan;
	hchan = go$newType(0, "Struct", "runtime.hchan", "hchan", "runtime", function(qcount_, dataqsiz_, elemsize_, pad_, closed_, elemalg_, sendx_, recvx_, recvq_, sendq_, lock_) {
		this.go$val = this;
		this.qcount = qcount_ !== undefined ? qcount_ : new Go$Uint64(0, 0);
		this.dataqsiz = dataqsiz_ !== undefined ? dataqsiz_ : new Go$Uint64(0, 0);
		this.elemsize = elemsize_ !== undefined ? elemsize_ : 0;
		this.pad = pad_ !== undefined ? pad_ : 0;
		this.closed = closed_ !== undefined ? closed_ : 0;
		this.elemalg = elemalg_ !== undefined ? elemalg_ : (go$ptrType(alg)).nil;
		this.sendx = sendx_ !== undefined ? sendx_ : new Go$Uint64(0, 0);
		this.recvx = recvx_ !== undefined ? recvx_ : new Go$Uint64(0, 0);
		this.recvq = recvq_ !== undefined ? recvq_ : new waitq.Ptr();
		this.sendq = sendq_ !== undefined ? sendq_ : new waitq.Ptr();
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
	});
	go$pkg.hchan = hchan;
	var scase;
	scase = go$newType(0, "Struct", "runtime.scase", "scase", "runtime", function(sg_, _chan_, pc_, kind_, so_, receivedp_) {
		this.go$val = this;
		this.sg = sg_ !== undefined ? sg_ : new sudog.Ptr();
		this._chan = _chan_ !== undefined ? _chan_ : (go$ptrType(hchan)).nil;
		this.pc = pc_ !== undefined ? pc_ : (go$ptrType(Go$Uint8)).nil;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.so = so_ !== undefined ? so_ : 0;
		this.receivedp = receivedp_ !== undefined ? receivedp_ : (go$ptrType(Go$Uint8)).nil;
	});
	go$pkg.scase = scase;
	var _select;
	_select = go$newType(0, "Struct", "runtime._select", "_select", "runtime", function(tcase_, ncase_, pollorder_, lockorder_, scase_) {
		this.go$val = this;
		this.tcase = tcase_ !== undefined ? tcase_ : 0;
		this.ncase = ncase_ !== undefined ? ncase_ : 0;
		this.pollorder = pollorder_ !== undefined ? pollorder_ : (go$ptrType(Go$Uint16)).nil;
		this.lockorder = lockorder_ !== undefined ? lockorder_ : (go$ptrType((go$ptrType(hchan)))).nil;
		this.scase = scase_ !== undefined ? scase_ : go$makeNativeArray("Struct", 1, function() { return new scase.Ptr(); });
	});
	go$pkg._select = _select;
	var runtimeselect;
	runtimeselect = go$newType(0, "Struct", "runtime.runtimeselect", "runtimeselect", "runtime", function(dir_, typ_, ch_, val_) {
		this.go$val = this;
		this.dir = dir_ !== undefined ? dir_ : new Go$Uint64(0, 0);
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(chantype)).nil;
		this.ch = ch_ !== undefined ? ch_ : (go$ptrType(hchan)).nil;
		this.val = val_ !== undefined ? val_ : new Go$Uint64(0, 0);
	});
	go$pkg.runtimeselect = runtimeselect;
	var parforthread;
	parforthread = go$newType(0, "Struct", "runtime.parforthread", "parforthread", "runtime", function(pos_, nsteal_, nstealcnt_, nprocyield_, nosyield_, nsleep_, pad_) {
		this.go$val = this;
		this.pos = pos_ !== undefined ? pos_ : new Go$Uint64(0, 0);
		this.nsteal = nsteal_ !== undefined ? nsteal_ : new Go$Uint64(0, 0);
		this.nstealcnt = nstealcnt_ !== undefined ? nstealcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg.parforthread = parforthread;
	MemProfileRecord.init([["AllocBytes", "", Go$Int64, ""], ["FreeBytes", "", Go$Int64, ""], ["AllocObjects", "", Go$Int64, ""], ["FreeObjects", "", Go$Int64, ""], ["Stack0", "", (go$arrayType(Go$Uintptr, 32)), ""]]);
	(go$ptrType(MemProfileRecord)).methods = [["InUseBytes", "", [], [Go$Int64], false], ["InUseObjects", "", [], [Go$Int64], false], ["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	StackRecord.init([["Stack0", "", (go$arrayType(Go$Uintptr, 32)), ""]]);
	(go$ptrType(StackRecord)).methods = [["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	BlockProfileRecord.init([["Count", "", Go$Int64, ""], ["Cycles", "", Go$Int64, ""], ["", "", StackRecord, ""]]);
	(go$ptrType(BlockProfileRecord)).methods = [["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	Error.init([["Error", "", (go$funcType([], [Go$String], false))], ["RuntimeError", "", (go$funcType([], [], false))]]);
	TypeAssertionError.init([["interfaceString", "runtime", Go$String, ""], ["concreteString", "runtime", Go$String, ""], ["assertedString", "runtime", Go$String, ""], ["missingMethod", "runtime", Go$String, ""]]);
	(go$ptrType(TypeAssertionError)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	errorString.methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	errorCString.methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	(go$ptrType(errorCString)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	stringer.init([["String", "", (go$funcType([], [Go$String], false))]]);
	Func.init([["opaque", "runtime", (go$structType([])), ""]]);
	(go$ptrType(Func)).methods = [["Entry", "", [], [Go$Uintptr], false], ["FileLine", "", [Go$Uintptr], [Go$String, Go$Int], false], ["Name", "", [], [Go$String], false]];
	MemStats.init([["Alloc", "", Go$Uint64, ""], ["TotalAlloc", "", Go$Uint64, ""], ["Sys", "", Go$Uint64, ""], ["Lookups", "", Go$Uint64, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""], ["HeapAlloc", "", Go$Uint64, ""], ["HeapSys", "", Go$Uint64, ""], ["HeapIdle", "", Go$Uint64, ""], ["HeapInuse", "", Go$Uint64, ""], ["HeapReleased", "", Go$Uint64, ""], ["HeapObjects", "", Go$Uint64, ""], ["StackInuse", "", Go$Uint64, ""], ["StackSys", "", Go$Uint64, ""], ["MSpanInuse", "", Go$Uint64, ""], ["MSpanSys", "", Go$Uint64, ""], ["MCacheInuse", "", Go$Uint64, ""], ["MCacheSys", "", Go$Uint64, ""], ["BuckHashSys", "", Go$Uint64, ""], ["GCSys", "", Go$Uint64, ""], ["OtherSys", "", Go$Uint64, ""], ["NextGC", "", Go$Uint64, ""], ["LastGC", "", Go$Uint64, ""], ["PauseTotalNs", "", Go$Uint64, ""], ["PauseNs", "", (go$arrayType(Go$Uint64, 256)), ""], ["NumGC", "", Go$Uint32, ""], ["EnableGC", "", Go$Bool, ""], ["DebugGC", "", Go$Bool, ""], ["BySize", "", (go$arrayType((go$structType([["Size", "", Go$Uint32, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""]])), 61)), ""]]);
	rtype.init([["size", "runtime", Go$Uintptr, ""], ["hash", "runtime", Go$Uint32, ""], ["_", "runtime", Go$Uint8, ""], ["align", "runtime", Go$Uint8, ""], ["fieldAlign", "runtime", Go$Uint8, ""], ["kind", "runtime", Go$Uint8, ""], ["alg", "runtime", Go$UnsafePointer, ""], ["gc", "runtime", Go$UnsafePointer, ""], ["string", "runtime", (go$ptrType(Go$String)), ""], ["", "runtime", (go$ptrType(uncommonType)), ""], ["ptrToThis", "runtime", (go$ptrType(rtype)), ""]]);
	_method.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["mtyp", "runtime", (go$ptrType(rtype)), ""], ["typ", "runtime", (go$ptrType(rtype)), ""], ["ifn", "runtime", Go$UnsafePointer, ""], ["tfn", "runtime", Go$UnsafePointer, ""]]);
	uncommonType.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["methods", "runtime", (go$sliceType(_method)), ""]]);
	_imethod.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["typ", "runtime", (go$ptrType(rtype)), ""]]);
	interfaceType.init([["", "runtime", rtype, ""], ["methods", "runtime", (go$sliceType(_imethod)), ""]]);
	lock.init([["key", "runtime", Go$Uint64, ""]]);
	note.init([["key", "runtime", Go$Uint64, ""]]);
	_string.init([["str", "runtime", (go$ptrType(Go$Uint8)), ""], ["len", "runtime", Go$Int64, ""]]);
	funcval.init([["fn", "runtime", (go$funcType([], [], false)), ""]]);
	iface.init([["tab", "runtime", (go$ptrType(itab)), ""], ["data", "runtime", Go$UnsafePointer, ""]]);
	eface.init([["_type", "runtime", (go$ptrType(_type)), ""], ["data", "runtime", Go$UnsafePointer, ""]]);
	_complex64.init([["real", "runtime", Go$Float32, ""], ["imag", "runtime", Go$Float32, ""]]);
	_complex128.init([["real", "runtime", Go$Float64, ""], ["imag", "runtime", Go$Float64, ""]]);
	slice.init([["array", "runtime", (go$ptrType(Go$Uint8)), ""], ["len", "runtime", Go$Uint64, ""], ["cap", "runtime", Go$Uint64, ""]]);
	gobuf.init([["sp", "runtime", Go$Uint64, ""], ["pc", "runtime", Go$Uint64, ""], ["g", "runtime", (go$ptrType(g)), ""], ["ret", "runtime", Go$Uint64, ""], ["ctxt", "runtime", Go$UnsafePointer, ""], ["lr", "runtime", Go$Uint64, ""]]);
	gcstats.init([["nhandoff", "runtime", Go$Uint64, ""], ["nhandoffcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""]]);
	wincall.init([["fn", "runtime", (go$funcType([Go$UnsafePointer], [], false)), ""], ["n", "runtime", Go$Uint64, ""], ["args", "runtime", Go$UnsafePointer, ""], ["r1", "runtime", Go$Uint64, ""], ["r2", "runtime", Go$Uint64, ""], ["err", "runtime", Go$Uint64, ""]]);
	seh.init([["prev", "runtime", Go$UnsafePointer, ""], ["handler", "runtime", Go$UnsafePointer, ""]]);
	wincallbackcontext.init([["gobody", "runtime", Go$UnsafePointer, ""], ["argsize", "runtime", Go$Uint64, ""], ["restorestack", "runtime", Go$Uint64, ""]]);
	g.init([["stackguard0", "runtime", Go$Uint64, ""], ["stackbase", "runtime", Go$Uint64, ""], ["panicwrap", "runtime", Go$Uint32, ""], ["selgen", "runtime", Go$Uint32, ""], ["_defer", "runtime", (go$ptrType(_defer)), ""], ["_panic", "runtime", (go$ptrType(_panic)), ""], ["sched", "runtime", gobuf, ""], ["syscallstack", "runtime", Go$Uint64, ""], ["syscallsp", "runtime", Go$Uint64, ""], ["syscallpc", "runtime", Go$Uint64, ""], ["syscallguard", "runtime", Go$Uint64, ""], ["stackguard", "runtime", Go$Uint64, ""], ["stack0", "runtime", Go$Uint64, ""], ["stacksize", "runtime", Go$Uint64, ""], ["alllink", "runtime", (go$ptrType(g)), ""], ["param", "runtime", Go$UnsafePointer, ""], ["status", "runtime", Go$Int16, ""], ["goid", "runtime", Go$Int64, ""], ["waitreason", "runtime", (go$ptrType(Go$Int8)), ""], ["schedlink", "runtime", (go$ptrType(g)), ""], ["ispanic", "runtime", Go$Uint8, ""], ["issystem", "runtime", Go$Uint8, ""], ["isbackground", "runtime", Go$Uint8, ""], ["preempt", "runtime", Go$Uint8, ""], ["raceignore", "runtime", Go$Int8, ""], ["m", "runtime", (go$ptrType(m)), ""], ["lockedm", "runtime", (go$ptrType(m)), ""], ["sig", "runtime", Go$Int32, ""], ["writenbuf", "runtime", Go$Int32, ""], ["writebuf", "runtime", (go$ptrType(Go$Uint8)), ""], ["dchunk", "runtime", (go$ptrType(deferchunk)), ""], ["dchunknext", "runtime", (go$ptrType(deferchunk)), ""], ["sigcode0", "runtime", Go$Uint64, ""], ["sigcode1", "runtime", Go$Uint64, ""], ["sigpc", "runtime", Go$Uint64, ""], ["gopc", "runtime", Go$Uint64, ""], ["racectx", "runtime", Go$Uint64, ""], ["end", "runtime", (go$arrayType(Go$Uint64, 0)), ""]]);
	m.init([["g0", "runtime", (go$ptrType(g)), ""], ["moreargp", "runtime", Go$UnsafePointer, ""], ["morebuf", "runtime", gobuf, ""], ["moreframesize", "runtime", Go$Uint32, ""], ["moreargsize", "runtime", Go$Uint32, ""], ["cret", "runtime", Go$Uint64, ""], ["procid", "runtime", Go$Uint64, ""], ["gsignal", "runtime", (go$ptrType(g)), ""], ["tls", "runtime", (go$arrayType(Go$Uint64, 4)), ""], ["mstartfn", "runtime", (go$funcType([], [], false)), ""], ["curg", "runtime", (go$ptrType(g)), ""], ["caughtsig", "runtime", (go$ptrType(g)), ""], ["p", "runtime", (go$ptrType(p)), ""], ["nextp", "runtime", (go$ptrType(p)), ""], ["id", "runtime", Go$Int32, ""], ["mallocing", "runtime", Go$Int32, ""], ["throwing", "runtime", Go$Int32, ""], ["gcing", "runtime", Go$Int32, ""], ["locks", "runtime", Go$Int32, ""], ["dying", "runtime", Go$Int32, ""], ["profilehz", "runtime", Go$Int32, ""], ["helpgc", "runtime", Go$Int32, ""], ["spinning", "runtime", Go$Uint8, ""], ["fastrand", "runtime", Go$Uint32, ""], ["ncgocall", "runtime", Go$Uint64, ""], ["ncgo", "runtime", Go$Int32, ""], ["cgomal", "runtime", (go$ptrType(cgomal)), ""], ["park", "runtime", note, ""], ["alllink", "runtime", (go$ptrType(m)), ""], ["schedlink", "runtime", (go$ptrType(m)), ""], ["machport", "runtime", Go$Uint32, ""], ["mcache", "runtime", (go$ptrType(mcache)), ""], ["stackinuse", "runtime", Go$Int32, ""], ["stackcachepos", "runtime", Go$Uint32, ""], ["stackcachecnt", "runtime", Go$Uint32, ""], ["stackcache", "runtime", (go$arrayType(Go$UnsafePointer, 32)), ""], ["lockedg", "runtime", (go$ptrType(g)), ""], ["createstack", "runtime", (go$arrayType(Go$Uint64, 32)), ""], ["freglo", "runtime", (go$arrayType(Go$Uint32, 16)), ""], ["freghi", "runtime", (go$arrayType(Go$Uint32, 16)), ""], ["fflag", "runtime", Go$Uint32, ""], ["locked", "runtime", Go$Uint32, ""], ["nextwaitm", "runtime", (go$ptrType(m)), ""], ["waitsema", "runtime", Go$Uint64, ""], ["waitsemacount", "runtime", Go$Uint32, ""], ["waitsemalock", "runtime", Go$Uint32, ""], ["gcstats", "runtime", gcstats, ""], ["racecall", "runtime", Go$Uint8, ""], ["needextram", "runtime", Go$Uint8, ""], ["waitunlockf", "runtime", (go$funcType([(go$ptrType(lock))], [], false)), ""], ["waitlock", "runtime", Go$UnsafePointer, ""], ["settype_buf", "runtime", (go$arrayType(Go$Uint64, 1024)), ""], ["settype_bufsize", "runtime", Go$Uint64, ""], ["seh", "runtime", (go$ptrType(seh)), ""], ["end", "runtime", (go$arrayType(Go$Uint64, 0)), ""]]);
	p.init([["", "runtime", lock, ""], ["id", "runtime", Go$Int32, ""], ["status", "runtime", Go$Uint32, ""], ["link", "runtime", (go$ptrType(p)), ""], ["schedtick", "runtime", Go$Uint32, ""], ["syscalltick", "runtime", Go$Uint32, ""], ["m", "runtime", (go$ptrType(m)), ""], ["mcache", "runtime", (go$ptrType(mcache)), ""], ["runq", "runtime", (go$ptrType((go$ptrType(g)))), ""], ["runqhead", "runtime", Go$Int32, ""], ["runqtail", "runtime", Go$Int32, ""], ["runqsize", "runtime", Go$Int32, ""], ["gfree", "runtime", (go$ptrType(g)), ""], ["gfreecnt", "runtime", Go$Int32, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	stktop.init([["stackguard", "runtime", Go$Uint64, ""], ["stackbase", "runtime", Go$Uint64, ""], ["gobuf", "runtime", gobuf, ""], ["argsize", "runtime", Go$Uint32, ""], ["panicwrap", "runtime", Go$Uint32, ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["free", "runtime", Go$Uint64, ""], ["_panic", "runtime", Go$Uint8, ""]]);
	sigtab.init([["flags", "runtime", Go$Int32, ""], ["name", "runtime", (go$ptrType(Go$Int8)), ""]]);
	_func.init([["entry", "runtime", Go$Uint64, ""], ["nameoff", "runtime", Go$Int32, ""], ["args", "runtime", Go$Int32, ""], ["frame", "runtime", Go$Int32, ""], ["pcsp", "runtime", Go$Int32, ""], ["pcfile", "runtime", Go$Int32, ""], ["pcln", "runtime", Go$Int32, ""], ["npcdata", "runtime", Go$Int32, ""], ["nfuncdata", "runtime", Go$Int32, ""]]);
	itab.init([["inter", "runtime", (go$ptrType(interfacetype)), ""], ["_type", "runtime", (go$ptrType(_type)), ""], ["link", "runtime", (go$ptrType(itab)), ""], ["bad", "runtime", Go$Int32, ""], ["unused", "runtime", Go$Int32, ""], ["fun", "runtime", (go$arrayType((go$funcType([], [], false)), 0)), ""]]);
	timers.init([["", "runtime", lock, ""], ["timerproc", "runtime", (go$ptrType(g)), ""], ["sleeping", "runtime", Go$Uint8, ""], ["rescheduling", "runtime", Go$Uint8, ""], ["waitnote", "runtime", note, ""], ["t", "runtime", (go$ptrType((go$ptrType(timer)))), ""], ["len", "runtime", Go$Int32, ""], ["cap", "runtime", Go$Int32, ""]]);
	timer.init([["i", "runtime", Go$Int32, ""], ["when", "runtime", Go$Int64, ""], ["period", "runtime", Go$Int64, ""], ["fv", "runtime", (go$ptrType(funcval)), ""], ["arg", "runtime", eface, ""]]);
	lfnode.init([["next", "runtime", (go$ptrType(lfnode)), ""], ["pushcnt", "runtime", Go$Uint64, ""]]);
	parfor.init([["body", "runtime", (go$funcType([(go$ptrType(parfor)), Go$Uint32], [], false)), ""], ["done", "runtime", Go$Uint32, ""], ["nthr", "runtime", Go$Uint32, ""], ["nthrmax", "runtime", Go$Uint32, ""], ["thrseq", "runtime", Go$Uint32, ""], ["cnt", "runtime", Go$Uint32, ""], ["ctx", "runtime", Go$UnsafePointer, ""], ["wait", "runtime", Go$Uint8, ""], ["thr", "runtime", (go$ptrType(parforthread)), ""], ["pad", "runtime", Go$Uint32, ""], ["nsteal", "runtime", Go$Uint64, ""], ["nstealcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""]]);
	cgomal.init([["next", "runtime", (go$ptrType(cgomal)), ""], ["alloc", "runtime", Go$UnsafePointer, ""]]);
	debugvars.init([["gctrace", "runtime", Go$Int32, ""], ["schedtrace", "runtime", Go$Int32, ""], ["scheddetail", "runtime", Go$Int32, ""]]);
	alg.init([["hash", "runtime", (go$funcType([(go$ptrType(Go$Uint64)), Go$Uint64, Go$UnsafePointer], [], false)), ""], ["equal", "runtime", (go$funcType([(go$ptrType(Go$Uint8)), Go$Uint64, Go$UnsafePointer, Go$UnsafePointer], [], false)), ""], ["print", "runtime", (go$funcType([Go$Uint64, Go$UnsafePointer], [], false)), ""], ["copy", "runtime", (go$funcType([Go$Uint64, Go$UnsafePointer, Go$UnsafePointer], [], false)), ""]]);
	_defer.init([["siz", "runtime", Go$Int32, ""], ["special", "runtime", Go$Uint8, ""], ["free", "runtime", Go$Uint8, ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["pc", "runtime", (go$ptrType(Go$Uint8)), ""], ["fn", "runtime", (go$ptrType(funcval)), ""], ["link", "runtime", (go$ptrType(_defer)), ""], ["args", "runtime", (go$arrayType(Go$UnsafePointer, 1)), ""]]);
	deferchunk.init([["prev", "runtime", (go$ptrType(deferchunk)), ""], ["off", "runtime", Go$Uint64, ""]]);
	_panic.init([["arg", "runtime", eface, ""], ["stackbase", "runtime", Go$Uint64, ""], ["link", "runtime", (go$ptrType(_panic)), ""], ["recovered", "runtime", Go$Uint8, ""]]);
	stkframe.init([["fn", "runtime", (go$ptrType(_func)), ""], ["pc", "runtime", Go$Uint64, ""], ["lr", "runtime", Go$Uint64, ""], ["sp", "runtime", Go$Uint64, ""], ["fp", "runtime", Go$Uint64, ""], ["varp", "runtime", (go$ptrType(Go$Uint8)), ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["arglen", "runtime", Go$Uint64, ""]]);
	mlink.init([["next", "runtime", (go$ptrType(mlink)), ""]]);
	fixalloc.init([["size", "runtime", Go$Uint64, ""], ["first", "runtime", (go$funcType([Go$UnsafePointer, (go$ptrType(Go$Uint8))], [], false)), ""], ["arg", "runtime", Go$UnsafePointer, ""], ["list", "runtime", (go$ptrType(mlink)), ""], ["chunk", "runtime", (go$ptrType(Go$Uint8)), ""], ["nchunk", "runtime", Go$Uint32, ""], ["inuse", "runtime", Go$Uint64, ""], ["stat", "runtime", (go$ptrType(Go$Uint64)), ""]]);
	_1_.init([["size", "runtime", Go$Uint32, ""], ["nmalloc", "runtime", Go$Uint64, ""], ["nfree", "runtime", Go$Uint64, ""]]);
	mstats.init([["alloc", "runtime", Go$Uint64, ""], ["total_alloc", "runtime", Go$Uint64, ""], ["sys", "runtime", Go$Uint64, ""], ["nlookup", "runtime", Go$Uint64, ""], ["nmalloc", "runtime", Go$Uint64, ""], ["nfree", "runtime", Go$Uint64, ""], ["heap_alloc", "runtime", Go$Uint64, ""], ["heap_sys", "runtime", Go$Uint64, ""], ["heap_idle", "runtime", Go$Uint64, ""], ["heap_inuse", "runtime", Go$Uint64, ""], ["heap_released", "runtime", Go$Uint64, ""], ["heap_objects", "runtime", Go$Uint64, ""], ["stacks_inuse", "runtime", Go$Uint64, ""], ["stacks_sys", "runtime", Go$Uint64, ""], ["mspan_inuse", "runtime", Go$Uint64, ""], ["mspan_sys", "runtime", Go$Uint64, ""], ["mcache_inuse", "runtime", Go$Uint64, ""], ["mcache_sys", "runtime", Go$Uint64, ""], ["buckhash_sys", "runtime", Go$Uint64, ""], ["gc_sys", "runtime", Go$Uint64, ""], ["other_sys", "runtime", Go$Uint64, ""], ["next_gc", "runtime", Go$Uint64, ""], ["last_gc", "runtime", Go$Uint64, ""], ["pause_total_ns", "runtime", Go$Uint64, ""], ["pause_ns", "runtime", (go$arrayType(Go$Uint64, 256)), ""], ["numgc", "runtime", Go$Uint32, ""], ["enablegc", "runtime", Go$Uint8, ""], ["debuggc", "runtime", Go$Uint8, ""], ["by_size", "runtime", (go$arrayType(_1_, 61)), ""]]);
	mcachelist.init([["list", "runtime", (go$ptrType(mlink)), ""], ["nlist", "runtime", Go$Uint32, ""]]);
	mcache.init([["next_sample", "runtime", Go$Int32, ""], ["local_cachealloc", "runtime", Go$Int64, ""], ["list", "runtime", (go$arrayType(mcachelist, 61)), ""], ["local_nlookup", "runtime", Go$Uint64, ""], ["local_largefree", "runtime", Go$Uint64, ""], ["local_nlargefree", "runtime", Go$Uint64, ""], ["local_nsmallfree", "runtime", (go$arrayType(Go$Uint64, 61)), ""]]);
	mtypes.init([["compression", "runtime", Go$Uint8, ""], ["data", "runtime", Go$Uint64, ""]]);
	mspan.init([["next", "runtime", (go$ptrType(mspan)), ""], ["prev", "runtime", (go$ptrType(mspan)), ""], ["start", "runtime", Go$Uint64, ""], ["npages", "runtime", Go$Uint64, ""], ["freelist", "runtime", (go$ptrType(mlink)), ""], ["ref", "runtime", Go$Uint32, ""], ["sizeclass", "runtime", Go$Int32, ""], ["elemsize", "runtime", Go$Uint64, ""], ["state", "runtime", Go$Uint32, ""], ["unusedsince", "runtime", Go$Int64, ""], ["npreleased", "runtime", Go$Uint64, ""], ["limit", "runtime", (go$ptrType(Go$Uint8)), ""], ["types", "runtime", mtypes, ""]]);
	mcentral.init([["", "runtime", lock, ""], ["sizeclass", "runtime", Go$Int32, ""], ["nonempty", "runtime", mspan, ""], ["empty", "runtime", mspan, ""], ["nfree", "runtime", Go$Int32, ""]]);
	_2_.init([["", "runtime", mcentral, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	mheap.init([["", "runtime", lock, ""], ["free", "runtime", (go$arrayType(mspan, 256)), ""], ["large", "runtime", mspan, ""], ["allspans", "runtime", (go$ptrType((go$ptrType(mspan)))), ""], ["nspan", "runtime", Go$Uint32, ""], ["nspancap", "runtime", Go$Uint32, ""], ["spans", "runtime", (go$ptrType((go$ptrType(mspan)))), ""], ["spans_mapped", "runtime", Go$Uint64, ""], ["bitmap", "runtime", (go$ptrType(Go$Uint8)), ""], ["bitmap_mapped", "runtime", Go$Uint64, ""], ["arena_start", "runtime", (go$ptrType(Go$Uint8)), ""], ["arena_used", "runtime", (go$ptrType(Go$Uint8)), ""], ["arena_end", "runtime", (go$ptrType(Go$Uint8)), ""], ["central", "runtime", (go$arrayType(_2_, 61)), ""], ["spanalloc", "runtime", fixalloc, ""], ["cachealloc", "runtime", fixalloc, ""], ["largefree", "runtime", Go$Uint64, ""], ["nlargefree", "runtime", Go$Uint64, ""], ["nsmallfree", "runtime", (go$arrayType(Go$Uint64, 61)), ""]]);
	_type.init([["size", "runtime", Go$Uint64, ""], ["hash", "runtime", Go$Uint32, ""], ["_unused", "runtime", Go$Uint8, ""], ["align", "runtime", Go$Uint8, ""], ["fieldalign", "runtime", Go$Uint8, ""], ["kind", "runtime", Go$Uint8, ""], ["alg", "runtime", (go$ptrType(alg)), ""], ["gc", "runtime", Go$UnsafePointer, ""], ["_string", "runtime", (go$ptrType(Go$String)), ""], ["x", "runtime", (go$ptrType(uncommontype)), ""], ["ptrto", "runtime", (go$ptrType(_type)), ""]]);
	method.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["mtyp", "runtime", (go$ptrType(_type)), ""], ["typ", "runtime", (go$ptrType(_type)), ""], ["ifn", "runtime", (go$funcType([], [], false)), ""], ["tfn", "runtime", (go$funcType([], [], false)), ""]]);
	uncommontype.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["mhdr", "runtime", (go$sliceType(Go$Uint8)), ""], ["m", "runtime", (go$arrayType(method, 0)), ""]]);
	imethod.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["_type", "runtime", (go$ptrType(_type)), ""]]);
	interfacetype.init([["", "runtime", _type, ""], ["mhdr", "runtime", (go$sliceType(Go$Uint8)), ""], ["m", "runtime", (go$arrayType(imethod, 0)), ""]]);
	maptype.init([["", "runtime", _type, ""], ["key", "runtime", (go$ptrType(_type)), ""], ["elem", "runtime", (go$ptrType(_type)), ""], ["bucket", "runtime", (go$ptrType(_type)), ""], ["hmap", "runtime", (go$ptrType(_type)), ""]]);
	chantype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""], ["dir", "runtime", Go$Uint64, ""]]);
	slicetype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""]]);
	functype.init([["", "runtime", _type, ""], ["dotdotdot", "runtime", Go$Uint8, ""], ["in", "runtime", (go$sliceType(Go$Uint8)), ""], ["out", "runtime", (go$sliceType(Go$Uint8)), ""]]);
	ptrtype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""]]);
	sched.init([["", "runtime", lock, ""], ["goidgen", "runtime", Go$Uint64, ""], ["midle", "runtime", (go$ptrType(m)), ""], ["nmidle", "runtime", Go$Int32, ""], ["nmidlelocked", "runtime", Go$Int32, ""], ["mcount", "runtime", Go$Int32, ""], ["maxmcount", "runtime", Go$Int32, ""], ["pidle", "runtime", (go$ptrType(p)), ""], ["npidle", "runtime", Go$Uint32, ""], ["nmspinning", "runtime", Go$Uint32, ""], ["runqhead", "runtime", (go$ptrType(g)), ""], ["runqtail", "runtime", (go$ptrType(g)), ""], ["runqsize", "runtime", Go$Int32, ""], ["gflock", "runtime", lock, ""], ["gfree", "runtime", (go$ptrType(g)), ""], ["gcwaiting", "runtime", Go$Uint32, ""], ["stopwait", "runtime", Go$Int32, ""], ["stopnote", "runtime", note, ""], ["sysmonwait", "runtime", Go$Uint32, ""], ["sysmonnote", "runtime", note, ""], ["lastpoll", "runtime", Go$Uint64, ""], ["profilehz", "runtime", Go$Int32, ""]]);
	cgothreadstart.init([["m", "runtime", (go$ptrType(m)), ""], ["g", "runtime", (go$ptrType(g)), ""], ["fn", "runtime", (go$funcType([], [], false)), ""]]);
	_3_.init([["", "runtime", lock, ""], ["fn", "runtime", (go$funcType([(go$ptrType(Go$Uint64)), Go$Int32], [], false)), ""], ["hz", "runtime", Go$Int32, ""], ["pcbuf", "runtime", (go$arrayType(Go$Uint64, 100)), ""]]);
	pdesc.init([["schedtick", "runtime", Go$Uint32, ""], ["schedwhen", "runtime", Go$Int64, ""], ["syscalltick", "runtime", Go$Uint32, ""], ["syscallwhen", "runtime", Go$Int64, ""]]);
	bucket.init([["tophash", "runtime", (go$arrayType(Go$Uint8, 8)), ""], ["overflow", "runtime", (go$ptrType(bucket)), ""], ["data", "runtime", (go$arrayType(Go$Uint8, 1)), ""]]);
	hmap.init([["count", "runtime", Go$Uint64, ""], ["flags", "runtime", Go$Uint32, ""], ["hash0", "runtime", Go$Uint32, ""], ["b", "runtime", Go$Uint8, ""], ["keysize", "runtime", Go$Uint8, ""], ["valuesize", "runtime", Go$Uint8, ""], ["bucketsize", "runtime", Go$Uint16, ""], ["buckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["oldbuckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["nevacuate", "runtime", Go$Uint64, ""]]);
	hash_iter.init([["key", "runtime", (go$ptrType(Go$Uint8)), ""], ["value", "runtime", (go$ptrType(Go$Uint8)), ""], ["t", "runtime", (go$ptrType(maptype)), ""], ["h", "runtime", (go$ptrType(hmap)), ""], ["endbucket", "runtime", Go$Uint64, ""], ["wrapped", "runtime", Go$Uint8, ""], ["b", "runtime", Go$Uint8, ""], ["buckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["bucket", "runtime", Go$Uint64, ""], ["bptr", "runtime", (go$ptrType(bucket)), ""], ["i", "runtime", Go$Uint64, ""], ["check_bucket", "runtime", Go$Int64, ""]]);
	sudog.init([["g", "runtime", (go$ptrType(g)), ""], ["selgen", "runtime", Go$Uint32, ""], ["link", "runtime", (go$ptrType(sudog)), ""], ["releasetime", "runtime", Go$Int64, ""], ["elem", "runtime", (go$ptrType(Go$Uint8)), ""]]);
	waitq.init([["first", "runtime", (go$ptrType(sudog)), ""], ["last", "runtime", (go$ptrType(sudog)), ""]]);
	hchan.init([["qcount", "runtime", Go$Uint64, ""], ["dataqsiz", "runtime", Go$Uint64, ""], ["elemsize", "runtime", Go$Uint16, ""], ["pad", "runtime", Go$Uint16, ""], ["closed", "runtime", Go$Uint8, ""], ["elemalg", "runtime", (go$ptrType(alg)), ""], ["sendx", "runtime", Go$Uint64, ""], ["recvx", "runtime", Go$Uint64, ""], ["recvq", "runtime", waitq, ""], ["sendq", "runtime", waitq, ""], ["", "runtime", lock, ""]]);
	scase.init([["sg", "runtime", sudog, ""], ["_chan", "runtime", (go$ptrType(hchan)), ""], ["pc", "runtime", (go$ptrType(Go$Uint8)), ""], ["kind", "runtime", Go$Uint16, ""], ["so", "runtime", Go$Uint16, ""], ["receivedp", "runtime", (go$ptrType(Go$Uint8)), ""]]);
	_select.init([["tcase", "runtime", Go$Uint16, ""], ["ncase", "runtime", Go$Uint16, ""], ["pollorder", "runtime", (go$ptrType(Go$Uint16)), ""], ["lockorder", "runtime", (go$ptrType((go$ptrType(hchan)))), ""], ["scase", "runtime", (go$arrayType(scase, 1)), ""]]);
	runtimeselect.init([["dir", "runtime", Go$Uint64, ""], ["typ", "runtime", (go$ptrType(chantype)), ""], ["ch", "runtime", (go$ptrType(hchan)), ""], ["val", "runtime", Go$Uint64, ""]]);
	parforthread.init([["pos", "runtime", Go$Uint64, ""], ["nsteal", "runtime", Go$Uint64, ""], ["nstealcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	var Breakpoint = function() {
		throw go$panic("Native function not implemented: Breakpoint");
	};
	var LockOSThread = function() {
		throw go$panic("Native function not implemented: LockOSThread");
	};
	var UnlockOSThread = function() {
		throw go$panic("Native function not implemented: UnlockOSThread");
	};
	var GOMAXPROCS = function(n) {
		throw go$panic("Native function not implemented: GOMAXPROCS");
	};
	var NumCPU = function() {
		throw go$panic("Native function not implemented: NumCPU");
	};
	var NumCgoCall = function() {
		throw go$panic("Native function not implemented: NumCgoCall");
	};
	var NumGoroutine = function() {
		throw go$panic("Native function not implemented: NumGoroutine");
	};
	MemProfileRecord.prototype.InUseBytes = function() { return this.go$val.InUseBytes(); };
	MemProfileRecord.Ptr.prototype.InUseBytes = function() {
		var r, x, x$1;
		r = this;
		return (x = r.AllocBytes, x$1 = r.FreeBytes, new Go$Int64(x.high - x$1.high, x.low - x$1.low));
	};
	MemProfileRecord.prototype.InUseObjects = function() { return this.go$val.InUseObjects(); };
	MemProfileRecord.Ptr.prototype.InUseObjects = function() {
		var r, x, x$1;
		r = this;
		return (x = r.AllocObjects, x$1 = r.FreeObjects, new Go$Int64(x.high - x$1.high, x.low - x$1.low));
	};
	MemProfileRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	MemProfileRecord.Ptr.prototype.Stack = function() {
		var r, _ref, _i, v, i;
		r = this;
		_ref = r.Stack0;
		_i = 0;
		for (; _i < 32; _i += 1) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
		}
		return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0);
	};
	var MemProfile = function(p$1, inuseZero) {
		throw go$panic("Native function not implemented: MemProfile");
	};
	StackRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	StackRecord.Ptr.prototype.Stack = function() {
		var r, _ref, _i, v, i;
		r = this;
		_ref = r.Stack0;
		_i = 0;
		for (; _i < 32; _i += 1) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
		}
		return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0);
	};
	var ThreadCreateProfile = function(p$1) {
		throw go$panic("Native function not implemented: ThreadCreateProfile");
	};
	var GoroutineProfile = function(p$1) {
		throw go$panic("Native function not implemented: GoroutineProfile");
	};
	var CPUProfile = function() {
		throw go$panic("Native function not implemented: CPUProfile");
	};
	var SetCPUProfileRate = function(hz) {
		throw go$panic("Native function not implemented: SetCPUProfileRate");
	};
	var SetBlockProfileRate = function(rate) {
		throw go$panic("Native function not implemented: SetBlockProfileRate");
	};
	var BlockProfile = function(p$1) {
		throw go$panic("Native function not implemented: BlockProfile");
	};
	var Stack = function(buf, all) {
		throw go$panic("Native function not implemented: Stack");
	};
	TypeAssertionError.prototype.RuntimeError = function() { return this.go$val.RuntimeError(); };
	TypeAssertionError.Ptr.prototype.RuntimeError = function() {
	};
	TypeAssertionError.prototype.Error = function() { return this.go$val.Error(); };
	TypeAssertionError.Ptr.prototype.Error = function() {
		var e, inter;
		e = this;
		inter = e.interfaceString;
		if (inter === "") {
			inter = "interface";
		}
		if (e.concreteString === "") {
			return "interface conversion: " + inter + " is nil, not " + e.assertedString;
		}
		if (e.missingMethod === "") {
			return "interface conversion: " + inter + " is " + e.concreteString + ", not " + e.assertedString;
		}
		return "interface conversion: " + e.concreteString + " is not " + e.assertedString + ": missing method " + e.missingMethod;
	};
	var newTypeAssertionError = function(ps1, ps2, ps3, pmeth, ret) {
		var s1, s2, s3, meth;
		s1 = "", s2 = "", s3 = "", meth = "";
		if (!(go$pointerIsEqual(ps1, (go$ptrType(Go$String)).nil))) {
			s1 = ps1.go$get();
		}
		if (!(go$pointerIsEqual(ps2, (go$ptrType(Go$String)).nil))) {
			s2 = ps2.go$get();
		}
		if (!(go$pointerIsEqual(ps3, (go$ptrType(Go$String)).nil))) {
			s3 = ps3.go$get();
		}
		if (!(go$pointerIsEqual(pmeth, (go$ptrType(Go$String)).nil))) {
			meth = pmeth.go$get();
		}
		ret.go$set(new TypeAssertionError.Ptr(s1, s2, s3, meth));
	};
	errorString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorString).prototype.RuntimeError = function() { return new errorString(this.go$get()).RuntimeError(); };
	errorString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + e;
	};
	go$ptrType(errorString).prototype.Error = function() { return new errorString(this.go$get()).Error(); };
	var newErrorString = function(s, ret) {
		ret.go$set(new errorString(s));
	};
	errorCString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorCString).prototype.RuntimeError = function() { return new errorCString(this.go$get()).RuntimeError(); };
	var cstringToGo = function() {
		throw go$panic("Native function not implemented: cstringToGo");
	};
	errorCString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + cstringToGo((e >>> 0));
	};
	go$ptrType(errorCString).prototype.Error = function() { return new errorCString(this.go$get()).Error(); };
	var newErrorCString = function(s, ret) {
		ret.go$set(new errorCString((s >>> 0)));
	};
	var typestring = function() {
		throw go$panic("Native function not implemented: typestring");
	};
	var printany = function(i) {
		var v, _ref, _type$1;
		_ref = i;
		_type$1 = _ref !== null ? _ref.constructor : null;
		if (_type$1 === null) {
			v = _ref;
			console.log("nil");
		} else if (stringer.implementedBy.indexOf(_type$1) !== -1) {
			v = _ref;
			console.log(v.String());
		} else if (go$error.implementedBy.indexOf(_type$1) !== -1) {
			v = _ref;
			console.log(v.Error());
		} else if (_type$1 === Go$Int) {
			v = _ref.go$val;
			console.log(v);
		} else if (_type$1 === Go$String) {
			v = _ref.go$val;
			console.log(v);
		} else {
			v = _ref;
			console.log("(", typestring(i), ") ", i);
		}
	};
	var panicwrap = function(pkg, typ, meth) {
		throw go$panic(new Go$String("value method " + pkg + "." + typ + "." + meth + " called using nil *" + typ + " pointer"));
	};
	var Gosched = function() {
		throw go$panic("Native function not implemented: Gosched");
	};
	var Goexit = function() {
		throw go$panic("Native function not implemented: Goexit");
	};
	var Caller = function(skip) {
		throw go$panic("Native function not implemented: Caller");
	};
	var Callers = function(skip, pc) {
		throw go$panic("Native function not implemented: Callers");
	};
	var FuncForPC = function(pc) {
		throw go$panic("Native function not implemented: FuncForPC");
	};
	Func.prototype.Name = function() { return this.go$val.Name(); };
	Func.Ptr.prototype.Name = function() {
		var f;
		f = this;
		return funcname_go(f);
	};
	Func.prototype.Entry = function() { return this.go$val.Entry(); };
	Func.Ptr.prototype.Entry = function() {
		var f;
		f = this;
		return funcentry_go(f);
	};
	Func.prototype.FileLine = function(pc) { return this.go$val.FileLine(pc); };
	Func.Ptr.prototype.FileLine = function(pc) {
		var file, line, f, _tuple;
		file = "";
		line = 0;
		f = this;
		_tuple = funcline_go(f, pc), file = _tuple[0], line = _tuple[1];
		return [file, line];
	};
	var funcline_go = function() {
		throw go$panic("Native function not implemented: funcline_go");
	};
	var funcname_go = function() {
		throw go$panic("Native function not implemented: funcname_go");
	};
	var funcentry_go = function() {
		throw go$panic("Native function not implemented: funcentry_go");
	};
	var SetFinalizer = function(x, f) {
		throw go$panic("Native function not implemented: SetFinalizer");
	};
	var getgoroot = function() {
		throw go$panic("Native function not implemented: getgoroot");
	};
	var GOROOT = function() {
		var s;
		s = getgoroot();
		if (!(s === "")) {
			return s;
		}
		return "/Users/ajhager/opt/go";
	};
	var Version = function() {
		return "go1.2";
	};
	var ReadMemStats = function(m$1) {
		throw go$panic("Native function not implemented: ReadMemStats");
	};
	var GC = function() {
		throw go$panic("Native function not implemented: GC");
	};
	var gc_m_ptr = function(ret) {
		ret.go$set((go$ptrType(m)).nil);
	};
	var gc_itab_ptr = function(ret) {
		ret.go$set((go$ptrType(itab)).nil);
	};
	var funpack64 = function(f) {
		var sign, mant, exp, inf, nan$1, _ref;
		sign = new Go$Uint64(0, 0);
		mant = new Go$Uint64(0, 0);
		exp = 0;
		inf = false;
		nan$1 = false;
		sign = new Go$Uint64(f.high & 2147483648, (f.low & 0) >>> 0);
		mant = new Go$Uint64(f.high & 1048575, (f.low & 4294967295) >>> 0);
		exp = ((go$shiftRightUint64(f, 52).low >> 0) & 2047);
		_ref = exp;
		if (_ref === 2047) {
			if (!((mant.high === 0 && mant.low === 0))) {
				nan$1 = true;
				return [sign, mant, exp, inf, nan$1];
			}
			inf = true;
			return [sign, mant, exp, inf, nan$1];
		} else if (_ref === 0) {
			if (!((mant.high === 0 && mant.low === 0))) {
				exp = (exp + -1022 >> 0);
				while ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
					mant = go$shiftLeft64(mant, 1);
					exp = (exp - 1 >> 0);
				}
			}
		} else {
			mant = new Go$Uint64(mant.high | 1048576, (mant.low | 0) >>> 0);
			exp = (exp + -1023 >> 0);
		}
		return [sign, mant, exp, inf, nan$1];
	};
	var funpack32 = function(f) {
		var sign, mant, exp, inf, nan$1, _ref;
		sign = 0;
		mant = 0;
		exp = 0;
		inf = false;
		nan$1 = false;
		sign = ((f & 2147483648) >>> 0);
		mant = ((f & 8388607) >>> 0);
		exp = (((f >>> 23 >>> 0) >> 0) & 255);
		_ref = exp;
		if (_ref === 255) {
			if (!(mant === 0)) {
				nan$1 = true;
				return [sign, mant, exp, inf, nan$1];
			}
			inf = true;
			return [sign, mant, exp, inf, nan$1];
		} else if (_ref === 0) {
			if (!(mant === 0)) {
				exp = (exp + -126 >> 0);
				while (mant < 8388608) {
					mant = (mant << 1 >>> 0);
					exp = (exp - 1 >> 0);
				}
			}
		} else {
			mant = ((mant | 8388608) >>> 0);
			exp = (exp + -127 >> 0);
		}
		return [sign, mant, exp, inf, nan$1];
	};
	var fpack64 = function(sign, mant, exp, trunc) {
		var _tuple, mant0, exp0, trunc0, x, x$1, x$2, _tuple$1, x$3, x$4, x$5, x$6, x$7, x$8;
		_tuple = [mant, exp, trunc], mant0 = _tuple[0], exp0 = _tuple[1], trunc0 = _tuple[2];
		if ((mant.high === 0 && mant.low === 0)) {
			return sign;
		}
		while ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
			mant = go$shiftLeft64(mant, 1);
			exp = (exp - 1 >> 0);
		}
		while ((mant.high > 4194304 || (mant.high === 4194304 && mant.low >= 0))) {
			trunc = (x = (new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0)), new Go$Uint64(trunc.high | x.high, (trunc.low | x.low) >>> 0));
			mant = go$shiftRightUint64(mant, 1);
			exp = (exp + 1 >> 0);
		}
		if ((mant.high > 2097152 || (mant.high === 2097152 && mant.low >= 0))) {
			if (!((x$1 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 0))) && (!((trunc.high === 0 && trunc.low === 0)) || !((x$2 = new Go$Uint64(mant.high & 0, (mant.low & 2) >>> 0), (x$2.high === 0 && x$2.low === 0))))) {
				mant = new Go$Uint64(mant.high + 0, mant.low + 1);
				if ((mant.high > 4194304 || (mant.high === 4194304 && mant.low >= 0))) {
					mant = go$shiftRightUint64(mant, 1);
					exp = (exp + 1 >> 0);
				}
			}
			mant = go$shiftRightUint64(mant, 1);
			exp = (exp + 1 >> 0);
		}
		if (exp >= 1024) {
			return new Go$Uint64(sign.high ^ 2146435072, (sign.low ^ 0) >>> 0);
		}
		if (exp < -1022) {
			if (exp < -1075) {
				return new Go$Uint64(sign.high | 0, (sign.low | 0) >>> 0);
			}
			_tuple$1 = [mant0, exp0, trunc0], mant = _tuple$1[0], exp = _tuple$1[1], trunc = _tuple$1[2];
			while (exp < -1023) {
				trunc = (x$3 = (new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0)), new Go$Uint64(trunc.high | x$3.high, (trunc.low | x$3.low) >>> 0));
				mant = go$shiftRightUint64(mant, 1);
				exp = (exp + 1 >> 0);
			}
			if (!((x$4 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), (x$4.high === 0 && x$4.low === 0))) && (!((trunc.high === 0 && trunc.low === 0)) || !((x$5 = new Go$Uint64(mant.high & 0, (mant.low & 2) >>> 0), (x$5.high === 0 && x$5.low === 0))))) {
				mant = new Go$Uint64(mant.high + 0, mant.low + 1);
			}
			mant = go$shiftRightUint64(mant, 1);
			exp = (exp + 1 >> 0);
			if ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
				return new Go$Uint64(sign.high | mant.high, (sign.low | mant.low) >>> 0);
			}
		}
		return (x$6 = (x$7 = go$shiftLeft64(new Go$Uint64(0, (exp - -1023 >> 0)), 52), new Go$Uint64(sign.high | x$7.high, (sign.low | x$7.low) >>> 0)), x$8 = new Go$Uint64(mant.high & 1048575, (mant.low & 4294967295) >>> 0), new Go$Uint64(x$6.high | x$8.high, (x$6.low | x$8.low) >>> 0));
	};
	var fpack32 = function(sign, mant, exp, trunc) {
		var _tuple, mant0, exp0, trunc0, _tuple$1;
		_tuple = [mant, exp, trunc], mant0 = _tuple[0], exp0 = _tuple[1], trunc0 = _tuple[2];
		if (mant === 0) {
			return sign;
		}
		while (mant < 8388608) {
			mant = (mant << 1 >>> 0);
			exp = (exp - 1 >> 0);
		}
		while (mant >= 33554432) {
			trunc = ((trunc | (((mant & 1) >>> 0))) >>> 0);
			mant = (mant >>> 1 >>> 0);
			exp = (exp + 1 >> 0);
		}
		if (mant >= 16777216) {
			if (!(((mant & 1) >>> 0) === 0) && (!(trunc === 0) || !(((mant & 2) >>> 0) === 0))) {
				mant = (mant + 1 >>> 0);
				if (mant >= 33554432) {
					mant = (mant >>> 1 >>> 0);
					exp = (exp + 1 >> 0);
				}
			}
			mant = (mant >>> 1 >>> 0);
			exp = (exp + 1 >> 0);
		}
		if (exp >= 128) {
			return ((sign ^ 2139095040) >>> 0);
		}
		if (exp < -126) {
			if (exp < -150) {
				return ((sign | 0) >>> 0);
			}
			_tuple$1 = [mant0, exp0, trunc0], mant = _tuple$1[0], exp = _tuple$1[1], trunc = _tuple$1[2];
			while (exp < -127) {
				trunc = ((trunc | (((mant & 1) >>> 0))) >>> 0);
				mant = (mant >>> 1 >>> 0);
				exp = (exp + 1 >> 0);
			}
			if (!(((mant & 1) >>> 0) === 0) && (!(trunc === 0) || !(((mant & 2) >>> 0) === 0))) {
				mant = (mant + 1 >>> 0);
			}
			mant = (mant >>> 1 >>> 0);
			exp = (exp + 1 >> 0);
			if (mant < 8388608) {
				return ((sign | mant) >>> 0);
			}
		}
		return ((((sign | (((exp - -127 >> 0) >>> 0) << 23 >>> 0)) >>> 0) | ((mant & 8388607) >>> 0)) >>> 0);
	};
	var fadd64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, x, _tuple$2, shift, x$1, x$2, trunc, x$3, x$4;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi && !((fs.high === gs.high && fs.low === gs.low))) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi) {
			return f;
		} else if (gi) {
			return g$1;
		} else if ((fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0) && !((fs.high === 0 && fs.low === 0)) && !((gs.high === 0 && gs.low === 0))) {
			return f;
		} else if ((fm.high === 0 && fm.low === 0)) {
			if ((gm.high === 0 && gm.low === 0)) {
				g$1 = (x = (gs), new Go$Uint64(g$1.high ^ x.high, (g$1.low ^ x.low) >>> 0));
			}
			return g$1;
		} else if ((gm.high === 0 && gm.low === 0)) {
			return f;
		}
		if (fe < ge || fe === ge && (fm.high < gm.high || (fm.high === gm.high && fm.low < gm.low))) {
			_tuple$2 = [g$1, f, gs, gm, ge, fs, fm, fe], f = _tuple$2[0], g$1 = _tuple$2[1], fs = _tuple$2[2], fm = _tuple$2[3], fe = _tuple$2[4], gs = _tuple$2[5], gm = _tuple$2[6], ge = _tuple$2[7];
		}
		shift = ((fe - ge >> 0) >>> 0);
		fm = go$shiftLeft64(fm, 2);
		gm = go$shiftLeft64(gm, 2);
		trunc = (x$1 = ((x$2 = go$shiftLeft64(new Go$Uint64(0, 1), shift), new Go$Uint64(x$2.high - 0, x$2.low - 1))), new Go$Uint64(gm.high & x$1.high, (gm.low & x$1.low) >>> 0));
		gm = go$shiftRightUint64(gm, (shift));
		if ((fs.high === gs.high && fs.low === gs.low)) {
			fm = (x$3 = (gm), new Go$Uint64(fm.high + x$3.high, fm.low + x$3.low));
		} else {
			fm = (x$4 = (gm), new Go$Uint64(fm.high - x$4.high, fm.low - x$4.low));
			if (!((trunc.high === 0 && trunc.low === 0))) {
				fm = new Go$Uint64(fm.high - 0, fm.low - 1);
			}
		}
		if ((fm.high === 0 && fm.low === 0)) {
			fs = new Go$Uint64(0, 0);
		}
		return fpack64(fs, fm, (fe - 2 >> 0), trunc);
	};
	var fsub64 = function(f, g$1) {
		return fadd64(f, fneg64(g$1));
	};
	var fneg64 = function(f) {
		return new Go$Uint64(f.high ^ 2147483648, (f.low ^ 0) >>> 0);
	};
	var fmul64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, _tuple$2, lo, hi, shift, x, x$1, trunc, x$2, x$3, mant;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi) {
			return new Go$Uint64(f.high ^ gs.high, (f.low ^ gs.low) >>> 0);
		} else if (fi && (gm.high === 0 && gm.low === 0) || (fm.high === 0 && fm.low === 0) && gi) {
			return new Go$Uint64(2146435072, 1);
		} else if ((fm.high === 0 && fm.low === 0)) {
			return new Go$Uint64(f.high ^ gs.high, (f.low ^ gs.low) >>> 0);
		} else if ((gm.high === 0 && gm.low === 0)) {
			return new Go$Uint64(g$1.high ^ fs.high, (g$1.low ^ fs.low) >>> 0);
		}
		_tuple$2 = mullu(fm, gm), lo = _tuple$2[0], hi = _tuple$2[1];
		shift = 51;
		trunc = (x = ((x$1 = go$shiftLeft64(new Go$Uint64(0, 1), shift), new Go$Uint64(x$1.high - 0, x$1.low - 1))), new Go$Uint64(lo.high & x.high, (lo.low & x.low) >>> 0));
		mant = (x$2 = go$shiftLeft64(hi, ((64 - shift >>> 0))), x$3 = go$shiftRightUint64(lo, shift), new Go$Uint64(x$2.high | x$3.high, (x$2.low | x$3.low) >>> 0));
		return fpack64(new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), mant, ((fe + ge >> 0) - 1 >> 0), trunc);
	};
	var fdiv64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, x, x$1, _tuple$2, shift, _tuple$3, q, r;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi) {
			return new Go$Uint64(2146435072, 1);
		} else if (!fi && !gi && (fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0)) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi || !gi && (gm.high === 0 && gm.low === 0)) {
			return (x = new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), new Go$Uint64(x.high ^ 2146435072, (x.low ^ 0) >>> 0));
		} else if (gi || (fm.high === 0 && fm.low === 0)) {
			return (x$1 = new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), new Go$Uint64(x$1.high ^ 0, (x$1.low ^ 0) >>> 0));
		}
		_tuple$2 = [fi, fn, gi, gn];
		shift = 54;
		_tuple$3 = divlu(go$shiftRightUint64(fm, ((64 - shift >>> 0))), go$shiftLeft64(fm, shift), gm), q = _tuple$3[0], r = _tuple$3[1];
		return fpack64(new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), q, ((fe - ge >> 0) - 2 >> 0), r);
	};
	var f64to32 = function(f) {
		var _tuple, fs, fm, fe, fi, fn, fs32;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fn) {
			return 2139095041;
		}
		fs32 = (go$shiftRightUint64(fs, 32).low >>> 0);
		if (fi) {
			return ((fs32 ^ 2139095040) >>> 0);
		}
		return fpack32(fs32, (go$shiftRightUint64(fm, 28).low >>> 0), (fe - 1 >> 0), (new Go$Uint64(fm.high & 0, (fm.low & 268435455) >>> 0).low >>> 0));
	};
	var f32to64 = function(f) {
		var _tuple, fs, fm, fe, fi, fn, fs64;
		_tuple = funpack32(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fn) {
			return new Go$Uint64(2146435072, 1);
		}
		fs64 = go$shiftLeft64(new Go$Uint64(0, fs), 32);
		if (fi) {
			return new Go$Uint64(fs64.high ^ 2146435072, (fs64.low ^ 0) >>> 0);
		}
		return fpack64(fs64, go$shiftLeft64(new Go$Uint64(0, fm), 29), fe, new Go$Uint64(0, 0));
	};
	var fcmp64 = function(f, g$1) {
		var cmp, isnan, _tuple, fs, fm, fi, fn, _tuple$1, gs, gm, gi, gn, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8;
		cmp = 0;
		isnan = false;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			_tuple$2 = [0, true], cmp = _tuple$2[0], isnan = _tuple$2[1];
			return [cmp, isnan];
		} else if (!fi && !gi && (fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0)) {
			_tuple$3 = [0, false], cmp = _tuple$3[0], isnan = _tuple$3[1];
			return [cmp, isnan];
		} else if ((fs.high > gs.high || (fs.high === gs.high && fs.low > gs.low))) {
			_tuple$4 = [-1, false], cmp = _tuple$4[0], isnan = _tuple$4[1];
			return [cmp, isnan];
		} else if ((fs.high < gs.high || (fs.high === gs.high && fs.low < gs.low))) {
			_tuple$5 = [1, false], cmp = _tuple$5[0], isnan = _tuple$5[1];
			return [cmp, isnan];
		} else if ((fs.high === 0 && fs.low === 0) && (f.high < g$1.high || (f.high === g$1.high && f.low < g$1.low)) || !((fs.high === 0 && fs.low === 0)) && (f.high > g$1.high || (f.high === g$1.high && f.low > g$1.low))) {
			_tuple$6 = [-1, false], cmp = _tuple$6[0], isnan = _tuple$6[1];
			return [cmp, isnan];
		} else if ((fs.high === 0 && fs.low === 0) && (f.high > g$1.high || (f.high === g$1.high && f.low > g$1.low)) || !((fs.high === 0 && fs.low === 0)) && (f.high < g$1.high || (f.high === g$1.high && f.low < g$1.low))) {
			_tuple$7 = [1, false], cmp = _tuple$7[0], isnan = _tuple$7[1];
			return [cmp, isnan];
		}
		_tuple$8 = [0, false], cmp = _tuple$8[0], isnan = _tuple$8[1];
		return [cmp, isnan];
	};
	var f64toint = function(f) {
		var val, ok, _tuple, fs, fm, fe, fi, fn, _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6;
		val = new Go$Int64(0, 0);
		ok = false;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fi || fn) {
			_tuple$1 = [new Go$Int64(0, 0), false], val = _tuple$1[0], ok = _tuple$1[1];
			return [val, ok];
		} else if (fe < -1) {
			_tuple$2 = [new Go$Int64(0, 0), false], val = _tuple$2[0], ok = _tuple$2[1];
			return [val, ok];
		} else if (fe > 63) {
			if (!((fs.high === 0 && fs.low === 0)) && (fm.high === 0 && fm.low === 0)) {
				_tuple$3 = [new Go$Int64(-2147483648, 0), true], val = _tuple$3[0], ok = _tuple$3[1];
				return [val, ok];
			}
			if (!((fs.high === 0 && fs.low === 0))) {
				_tuple$4 = [new Go$Int64(0, 0), false], val = _tuple$4[0], ok = _tuple$4[1];
				return [val, ok];
			}
			_tuple$5 = [new Go$Int64(0, 0), false], val = _tuple$5[0], ok = _tuple$5[1];
			return [val, ok];
		}
		while (fe > 52) {
			fe = (fe - 1 >> 0);
			fm = go$shiftLeft64(fm, 1);
		}
		while (fe < 52) {
			fe = (fe + 1 >> 0);
			fm = go$shiftRightUint64(fm, 1);
		}
		val = new Go$Int64(fm.high, fm.low);
		if (!((fs.high === 0 && fs.low === 0))) {
			val = new Go$Int64(-val.high, -val.low);
		}
		_tuple$6 = [val, true], val = _tuple$6[0], ok = _tuple$6[1];
		return [val, ok];
	};
	var fintto64 = function(val) {
		var f, x, fs, mant;
		f = new Go$Uint64(0, 0);
		fs = (x = new Go$Uint64(val.high, val.low), new Go$Uint64(x.high & 2147483648, (x.low & 0) >>> 0));
		mant = new Go$Uint64(val.high, val.low);
		if (!((fs.high === 0 && fs.low === 0))) {
			mant = new Go$Uint64(-mant.high, -mant.low);
		}
		f = fpack64(fs, mant, 52, new Go$Uint64(0, 0));
		return f;
	};
	var mullu = function(u, v) {
		var lo, hi, u0, u1, v0, v1, w0, x, x$1, t, w1, w2, x$2, x$3, x$4, x$5, _tuple;
		lo = new Go$Uint64(0, 0);
		hi = new Go$Uint64(0, 0);
		u0 = new Go$Uint64(u.high & 0, (u.low & 4294967295) >>> 0);
		u1 = go$shiftRightUint64(u, 32);
		v0 = new Go$Uint64(v.high & 0, (v.low & 4294967295) >>> 0);
		v1 = go$shiftRightUint64(v, 32);
		w0 = go$mul64(u0, v0);
		t = (x = go$mul64(u1, v0), x$1 = go$shiftRightUint64(w0, 32), new Go$Uint64(x.high + x$1.high, x.low + x$1.low));
		w1 = new Go$Uint64(t.high & 0, (t.low & 4294967295) >>> 0);
		w2 = go$shiftRightUint64(t, 32);
		w1 = (x$2 = (go$mul64(u0, v1)), new Go$Uint64(w1.high + x$2.high, w1.low + x$2.low));
		_tuple = [go$mul64(u, v), (x$3 = (x$4 = go$mul64(u1, v1), new Go$Uint64(x$4.high + w2.high, x$4.low + w2.low)), x$5 = go$shiftRightUint64(w1, 32), new Go$Uint64(x$3.high + x$5.high, x$3.low + x$5.low))], lo = _tuple[0], hi = _tuple[1];
		return [lo, hi];
	};
	var divlu = function(u1, u0, v) {
		var q, r, _tuple, s, x, vn1, vn0, x$1, x$2, un32, un10, un1, un0, q1, x$3, rhat, x$4, x$5, x$6, x$7, x$8, x$9, x$10, un21, q0, x$11, x$12, x$13, x$14, x$15, x$16, x$17, x$18, x$19, _tuple$1;
		q = new Go$Uint64(0, 0);
		r = new Go$Uint64(0, 0);
		if ((u1.high > v.high || (u1.high === v.high && u1.low >= v.low))) {
			_tuple = [new Go$Uint64(4294967295, 4294967295), new Go$Uint64(4294967295, 4294967295)], q = _tuple[0], r = _tuple[1];
			return [q, r];
		}
		s = 0;
		while ((x = new Go$Uint64(v.high & 2147483648, (v.low & 0) >>> 0), (x.high === 0 && x.low === 0))) {
			s = (s + 1 >>> 0);
			v = go$shiftLeft64(v, 1);
		}
		vn1 = go$shiftRightUint64(v, 32);
		vn0 = new Go$Uint64(v.high & 0, (v.low & 4294967295) >>> 0);
		un32 = (x$1 = go$shiftLeft64(u1, s), x$2 = go$shiftRightUint64(u0, ((64 - s >>> 0))), new Go$Uint64(x$1.high | x$2.high, (x$1.low | x$2.low) >>> 0));
		un10 = go$shiftLeft64(u0, s);
		un1 = go$shiftRightUint64(un10, 32);
		un0 = new Go$Uint64(un10.high & 0, (un10.low & 4294967295) >>> 0);
		q1 = go$div64(un32, vn1, false);
		rhat = (x$3 = go$mul64(q1, vn1), new Go$Uint64(un32.high - x$3.high, un32.low - x$3.low));
		if ((q1.high > 1 || (q1.high === 1 && q1.low >= 0)) || (x$4 = go$mul64(q1, vn0), x$5 = (x$6 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$6.high + un1.high, x$6.low + un1.low)), (x$4.high > x$5.high || (x$4.high === x$5.high && x$4.low > x$5.low)))) {
			q1 = new Go$Uint64(q1.high - 0, q1.low - 1);
			rhat = (x$7 = (vn1), new Go$Uint64(rhat.high + x$7.high, rhat.low + x$7.low));
			if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {
				go$notSupported("goto")
			}
		}
		un21 = (x$8 = (x$9 = go$mul64(un32, new Go$Uint64(1, 0)), new Go$Uint64(x$9.high + un1.high, x$9.low + un1.low)), x$10 = go$mul64(q1, v), new Go$Uint64(x$8.high - x$10.high, x$8.low - x$10.low));
		q0 = go$div64(un21, vn1, false);
		rhat = (x$11 = go$mul64(q0, vn1), new Go$Uint64(un21.high - x$11.high, un21.low - x$11.low));
		if ((q0.high > 1 || (q0.high === 1 && q0.low >= 0)) || (x$12 = go$mul64(q0, vn0), x$13 = (x$14 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$14.high + un0.high, x$14.low + un0.low)), (x$12.high > x$13.high || (x$12.high === x$13.high && x$12.low > x$13.low)))) {
			q0 = new Go$Uint64(q0.high - 0, q0.low - 1);
			rhat = (x$15 = (vn1), new Go$Uint64(rhat.high + x$15.high, rhat.low + x$15.low));
			if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {
				go$notSupported("goto")
			}
		}
		_tuple$1 = [(x$16 = go$mul64(q1, new Go$Uint64(1, 0)), new Go$Uint64(x$16.high + q0.high, x$16.low + q0.low)), go$shiftRightUint64(((x$17 = (x$18 = go$mul64(un21, new Go$Uint64(1, 0)), new Go$Uint64(x$18.high + un0.high, x$18.low + un0.low)), x$19 = go$mul64(q0, v), new Go$Uint64(x$17.high - x$19.high, x$17.low - x$19.low))), s)], q = _tuple$1[0], r = _tuple$1[1];
		return [q, r];
	};
	var fadd64c = function(f, g$1, ret) {
		ret.go$set(fadd64(f, g$1));
	};
	var fsub64c = function(f, g$1, ret) {
		ret.go$set(fsub64(f, g$1));
	};
	var fmul64c = function(f, g$1, ret) {
		ret.go$set(fmul64(f, g$1));
	};
	var fdiv64c = function(f, g$1, ret) {
		ret.go$set(fdiv64(f, g$1));
	};
	var fneg64c = function(f, ret) {
		ret.go$set(fneg64(f));
	};
	var f32to64c = function(f, ret) {
		ret.go$set(f32to64(f));
	};
	var f64to32c = function(f, ret) {
		ret.go$set(f64to32(f));
	};
	var fcmp64c = function(f, g$1, ret, retnan) {
		var _tuple;
		_tuple = fcmp64(f, g$1), ret.go$set(_tuple[0]), retnan.go$set(_tuple[1]);
	};
	var fintto64c = function(val, ret) {
		ret.go$set(fintto64(val));
	};
	var f64tointc = function(f, ret, retok) {
		var _tuple;
		_tuple = f64toint(f), ret.go$set(_tuple[0]), retok.go$set(_tuple[1]);
	};
	go$pkg.Compiler = "gc";
	go$pkg.GOOS = "darwin";
	go$pkg.GOARCH = "js";
	var mantbits64 = 52;
	var expbits64 = 11;
	var bias64 = -1023;
	var nan64 = new Go$Uint64(2146435072, 1);
	var inf64 = new Go$Uint64(2146435072, 0);
	var neg64 = new Go$Uint64(2147483648, 0);
	var mantbits32 = 23;
	var expbits32 = 8;
	var bias32 = -127;
	var nan32 = 2139095041;
	var inf32 = 2139095040;
	var neg32 = 2147483648;
	var theGoarch = "js";
	var theGoos = "darwin";
	var defaultGoroot = "/Users/ajhager/opt/go";
	var theVersion = "go1.2";
	go$pkg.MemProfileRate = 0;
	var sizeof_C_MStats = 0;
	var memStats = new MemStats.Ptr();
	var _ = 0;
	var precisestack = 0;
	var algarray = go$makeNativeArray("Struct", 22, function() { return new alg.Ptr(); });
	var startup_random_data = (go$ptrType(Go$Uint8)).nil;
	var startup_random_data_len = 0;
	var emptystring = "";
	var zerobase = new Go$Uint64(0, 0);
	var allg = (go$ptrType(g)).nil;
	var lastg = (go$ptrType(g)).nil;
	var allm = (go$ptrType(m)).nil;
	var allp = (go$ptrType((go$ptrType(p)))).nil;
	var gomaxprocs = 0;
	var needextram = 0;
	var panicking = 0;
	var goos = (go$ptrType(Go$Int8)).nil;
	var ncpu = 0;
	var iscgo = 0;
	var sysargs = go$throwNilPointerError;
	var maxstring = new Go$Uint64(0, 0);
	var hchansize = 0;
	var cpuid_ecx = 0;
	var cpuid_edx = 0;
	var debug = new debugvars.Ptr();
	var maxstacksize = new Go$Uint64(0, 0);
	var blockprofilerate = new Go$Int64(0, 0);
	var worldsema = 0;
	var nan = 0;
	var posinf = 0;
	var neginf = 0;
	var memstats = new mstats.Ptr();
	var class_to_size = go$makeNativeArray("Int32", 61, function() { return 0; });
	var class_to_allocnpages = go$makeNativeArray("Int32", 61, function() { return 0; });
	var size_to_class8 = go$makeNativeArray("Int8", 129, function() { return 0; });
	var size_to_class128 = go$makeNativeArray("Int8", 249, function() { return 0; });
	var checking = 0;
	var m0 = new m.Ptr();
	var g0 = new g.Ptr();
	var extram = (go$ptrType(m)).nil;
	var newprocs = 0;
	var scavenger = new funcval.Ptr();
	var initdone = new funcval.Ptr();
	var _cgo_thread_start = go$throwNilPointerError;
	var prof = new _3_.Ptr();
	var experiment = go$makeNativeArray("Int8", 0, function() { return 0; });
	var hash = go$makeNativeArray("Ptr", 1009, function() { return (go$ptrType(itab)).nil; });
	var ifacelock = new lock.Ptr();
	var typelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
	var etypelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
	var empty_value = go$makeNativeArray("Uint8", 128, function() { return 0; });
	var hashload = 0;
go$throwRuntimeError = function(msg) { throw go$panic(new errorString(msg)) };
		sizeof_C_MStats = 3712;
		getgoroot = function() { return (typeof process !== 'undefined') ? (process.env["GOROOT"] || "") : "/"; };
		Caller = function(skip) {
			var line = go$getStack()[skip + 3];
			if (line === undefined) {
				return [0, "", 0, false];
			}
			var parts = line.substring(line.indexOf("(") + 1, line.indexOf(")")).split(":");
			return [0, parts[0], parseInt(parts[1]), true];
		};
		GC = function() {};
		GOMAXPROCS = function(n) {
			if (n > 1) {
				go$notSupported("GOMAXPROCS != 1")
			}
			return 1;
		};
		Goexit = function() {
			var err = new Go$Error();
			err.go$exit = true;
			throw err;
		};
		NumCPU = function() { return 1; };
		ReadMemStats = function() {};
		SetFinalizer = function() {};
	go$pkg.Breakpoint = Breakpoint;
	go$pkg.LockOSThread = LockOSThread;
	go$pkg.UnlockOSThread = UnlockOSThread;
	go$pkg.GOMAXPROCS = GOMAXPROCS;
	go$pkg.NumCPU = NumCPU;
	go$pkg.NumCgoCall = NumCgoCall;
	go$pkg.NumGoroutine = NumGoroutine;
	go$pkg.MemProfile = MemProfile;
	go$pkg.ThreadCreateProfile = ThreadCreateProfile;
	go$pkg.GoroutineProfile = GoroutineProfile;
	go$pkg.CPUProfile = CPUProfile;
	go$pkg.SetCPUProfileRate = SetCPUProfileRate;
	go$pkg.SetBlockProfileRate = SetBlockProfileRate;
	go$pkg.BlockProfile = BlockProfile;
	go$pkg.Stack = Stack;
	go$pkg.Gosched = Gosched;
	go$pkg.Goexit = Goexit;
	go$pkg.Caller = Caller;
	go$pkg.Callers = Callers;
	go$pkg.FuncForPC = FuncForPC;
	go$pkg.SetFinalizer = SetFinalizer;
	go$pkg.GOROOT = GOROOT;
	go$pkg.Version = Version;
	go$pkg.ReadMemStats = ReadMemStats;
	go$pkg.GC = GC;
	go$pkg.init = function() {
		go$pkg.MemProfileRate = 524288;
		if (!(sizeof_C_MStats === 3712)) {
			console.log(sizeof_C_MStats, 3712);
			throw go$panic(new Go$String("MStats vs MemStatsType size mismatch"));
		}
	};
  return go$pkg;
})();
go$packages["errors"] = (function() {
  var go$pkg = {};
	var errorString;
	errorString = go$newType(0, "Struct", "errors.errorString", "errorString", "errors", function(s_) {
		this.go$val = this;
		this.s = s_ !== undefined ? s_ : "";
	});
	go$pkg.errorString = errorString;
	errorString.init([["s", "errors", Go$String, ""]]);
	(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false]];
	var New = function(text) {
		return new errorString.Ptr(text);
	};
	errorString.prototype.Error = function() { return this.go$val.Error(); };
	errorString.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.s;
	};
	go$pkg.New = New;
	go$pkg.init = function() {
	};
  return go$pkg;
})();
go$packages["github.com/neelance/gopherjs/js"] = (function() {
  var go$pkg = {};
	var Object;
	Object = go$newType(0, "Interface", "js.Object", "Object", "github.com/neelance/gopherjs/js", null);
	go$pkg.Object = Object;
	Object.init([["Bool", "", (go$funcType([], [Go$Bool], false))], ["Call", "", (go$funcType([Go$String, (go$sliceType((go$interfaceType([]))))], [Object], true))], ["Float", "", (go$funcType([], [Go$Float64], false))], ["Get", "", (go$funcType([Go$String], [Object], false))], ["Index", "", (go$funcType([Go$Int], [Object], false))], ["Int", "", (go$funcType([], [Go$Int], false))], ["Interface", "", (go$funcType([], [(go$interfaceType([]))], false))], ["Invoke", "", (go$funcType([(go$sliceType((go$interfaceType([]))))], [Object], true))], ["IsNull", "", (go$funcType([], [Go$Bool], false))], ["IsUndefined", "", (go$funcType([], [Go$Bool], false))], ["Length", "", (go$funcType([], [Go$Int], false))], ["New", "", (go$funcType([(go$sliceType((go$interfaceType([]))))], [Object], true))], ["Set", "", (go$funcType([Go$String, (go$interfaceType([]))], [], false))], ["SetIndex", "", (go$funcType([Go$Int, (go$interfaceType([]))], [], false))], ["String", "", (go$funcType([], [Go$String], false))]]);
	var Global = function(name) {
		return null;
	};
	go$pkg.Global = Global;
	go$pkg.init = function() {
	};
  return go$pkg;
})();
go$packages["github.com/ajhager/webgl"] = (function() {
  var go$pkg = {};
	var errors = go$packages["errors"];
	var js = go$packages["github.com/neelance/gopherjs/js"];
	var ContextAttributes;
	ContextAttributes = go$newType(0, "Struct", "webgl.ContextAttributes", "ContextAttributes", "github.com/ajhager/webgl", function(Alpha_, Depth_, Stencil_, Antialias_, PremultipliedAlpha_, PreserveDrawingBuffer_) {
		this.go$val = this;
		this.Alpha = Alpha_ !== undefined ? Alpha_ : false;
		this.Depth = Depth_ !== undefined ? Depth_ : false;
		this.Stencil = Stencil_ !== undefined ? Stencil_ : false;
		this.Antialias = Antialias_ !== undefined ? Antialias_ : false;
		this.PremultipliedAlpha = PremultipliedAlpha_ !== undefined ? PremultipliedAlpha_ : false;
		this.PreserveDrawingBuffer = PreserveDrawingBuffer_ !== undefined ? PreserveDrawingBuffer_ : false;
	});
	go$pkg.ContextAttributes = ContextAttributes;
	var Context;
	Context = go$newType(0, "Struct", "webgl.Context", "Context", "github.com/ajhager/webgl", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Context.prototype.Bool = function() { return this.go$val.Bool(); };
	Context.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Context.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Context.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Context.prototype.Float = function() { return this.go$val.Float(); };
	Context.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Context.prototype.Get = function(name) { return this.go$val.Get(name); };
	Context.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Context.prototype.Index = function(i) { return this.go$val.Index(i); };
	Context.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Context.prototype.Int = function() { return this.go$val.Int(); };
	Context.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Context.prototype.Interface = function() { return this.go$val.Interface(); };
	Context.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Context.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Context.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Context.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Context.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Context.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Context.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Context.prototype.Length = function() { return this.go$val.Length(); };
	Context.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Context.prototype.New = function(args) { return this.go$val.New(args); };
	Context.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Context.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Context.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Context.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Context.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Context.prototype.String = function() { return this.go$val.String(); };
	Context.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Context = Context;
	ContextAttributes.init([["Alpha", "", Go$Bool, ""], ["Depth", "", Go$Bool, ""], ["Stencil", "", Go$Bool, ""], ["Antialias", "", Go$Bool, ""], ["PremultipliedAlpha", "", Go$Bool, ""], ["PreserveDrawingBuffer", "", Go$Bool, ""]]);
	Context.init([["", "", js.Object, ""]]);
	Context.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Context)).methods = [["ActiveTexture", "", [Go$Int], [], false], ["AttachShader", "", [js.Object, js.Object], [], false], ["BindAttribLocation", "", [js.Object, Go$Int, Go$String], [], false], ["BindBuffer", "", [Go$Int, js.Object], [], false], ["BindFramebuffer", "", [Go$Int, js.Object], [], false], ["BindRenderbuffer", "", [Go$Int, js.Object], [], false], ["BindTexture", "", [Go$Int, js.Object], [], false], ["BlendColor", "", [Go$Float64, Go$Float64, Go$Float64, Go$Float64], [], false], ["BlendEquation", "", [Go$Int], [], false], ["BlendEquationSeparate", "", [Go$Int, Go$Int], [], false], ["BlendFunc", "", [Go$Int, Go$Int], [], false], ["BlendFuncSeparate", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Bool", "", [], [Go$Bool], false], ["BufferData", "", [Go$Int, js.Object, Go$Int], [], false], ["BufferSubData", "", [Go$Int, Go$Int, js.Object], [], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["CheckFramebufferStatus", "", [Go$Int], [Go$Int], false], ["Clear", "", [Go$Int], [], false], ["ClearColor", "", [Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["ClearDepth", "", [Go$Float64], [], false], ["ClearStencil", "", [Go$Int], [], false], ["ColorMask", "", [Go$Bool, Go$Bool, Go$Bool, Go$Bool], [], false], ["CompileShader", "", [js.Object], [], false], ["CopyTexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CopyTexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CreateBuffer", "", [], [js.Object], false], ["CreateFramebuffer", "", [], [js.Object], false], ["CreateProgram", "", [], [js.Object], false], ["CreateRenderbuffer", "", [], [js.Object], false], ["CreateShader", "", [Go$Int], [js.Object], false], ["CreateTexture", "", [], [js.Object], false], ["CullFace", "", [Go$Int], [], false], ["DeleteBuffer", "", [js.Object], [], false], ["DeleteFramebuffer", "", [js.Object], [], false], ["DeleteProgram", "", [js.Object], [], false], ["DeleteRenderbuffer", "", [js.Object], [], false], ["DeleteShader", "", [js.Object], [], false], ["DeleteTexture", "", [js.Object], [], false], ["DepthFunc", "", [Go$Int], [], false], ["DepthMask", "", [Go$Bool], [], false], ["DepthRange", "", [Go$Float64, Go$Float64], [], false], ["DetachShader", "", [js.Object, js.Object], [], false], ["Disable", "", [Go$Int], [], false], ["DisableVertexAttribArray", "", [Go$Int], [], false], ["DrawArrays", "", [Go$Int, Go$Int, Go$Int], [], false], ["DrawElements", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Enable", "", [Go$Int], [], false], ["EnableVertexAttribArray", "", [Go$Int], [], false], ["Finish", "", [], [], false], ["Float", "", [], [Go$Float64], false], ["Flush", "", [], [], false], ["FrameBufferRenderBuffer", "", [Go$Int, Go$Int, Go$Int, js.Object], [], false], ["FramebufferTexture2D", "", [Go$Int, Go$Int, Go$Int, js.Object, Go$Int], [], false], ["FrontFace", "", [Go$Int], [], false], ["GenerateMipmap", "", [Go$Int], [], false], ["Get", "", [Go$String], [js.Object], false], ["GetActiveAttrib", "", [js.Object, Go$Int], [js.Object], false], ["GetActiveUniform", "", [js.Object, Go$Int], [js.Object], false], ["GetAttachedShaders", "", [js.Object], [(go$sliceType(js.Object))], false], ["GetAttribLocation", "", [js.Object, Go$String], [Go$Int], false], ["GetBufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetContextAttributes", "", [], [ContextAttributes], false], ["GetError", "", [], [Go$Int], false], ["GetExtension", "", [Go$String], [js.Object], false], ["GetFramebufferAttachmentParameter", "", [Go$Int, Go$Int, Go$Int], [js.Object], false], ["GetParameter", "", [Go$Int], [js.Object], false], ["GetProgramInfoLog", "", [js.Object], [Go$String], false], ["GetProgramParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetProgramParameteri", "", [js.Object, Go$Int], [Go$Int], false], ["GetRenderbufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetShaderInfoLog", "", [js.Object], [Go$String], false], ["GetShaderParameter", "", [js.Object, Go$Int], [js.Object], false], ["GetShaderParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetShaderSource", "", [js.Object], [Go$String], false], ["GetSupportedExtensions", "", [], [(go$sliceType(Go$String))], false], ["GetTexParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetUniform", "", [js.Object, js.Object], [js.Object], false], ["GetUniformLocation", "", [js.Object, Go$String], [js.Object], false], ["GetVertexAttrib", "", [Go$Int, Go$Int], [js.Object], false], ["GetVertexAttribOffset", "", [Go$Int, Go$Int], [Go$Int], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsBuffer", "", [js.Object], [Go$Bool], false], ["IsContextLost", "", [], [Go$Bool], false], ["IsEnabled", "", [Go$Int], [Go$Bool], false], ["IsFramebuffer", "", [js.Object], [Go$Bool], false], ["IsNull", "", [], [Go$Bool], false], ["IsProgram", "", [js.Object], [Go$Bool], false], ["IsRenderbuffer", "", [js.Object], [Go$Bool], false], ["IsShader", "", [js.Object], [Go$Bool], false], ["IsTexture", "", [js.Object], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["LineWidth", "", [Go$Float64], [], false], ["LinkProgram", "", [js.Object], [], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["PixelStorei", "", [Go$Int, Go$Int], [], false], ["PolygonOffset", "", [Go$Float64, Go$Float64], [], false], ["ReadPixels", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["RenderbufferStorage", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Scissor", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["ShaderSource", "", [js.Object, Go$String], [], false], ["String", "", [], [Go$String], false], ["TexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["TexParameteri", "", [Go$Int, Go$Int, Go$Int], [], false], ["TexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["Uniform1f", "", [js.Object, Go$Float32], [], false], ["Uniform1i", "", [js.Object, Go$Int], [], false], ["Uniform2f", "", [js.Object, Go$Float32, Go$Float32], [], false], ["Uniform2i", "", [js.Object, Go$Int, Go$Int], [], false], ["Uniform3f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform3i", "", [js.Object, Go$Int, Go$Int, Go$Int], [], false], ["Uniform4f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform4i", "", [js.Object, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["UniformMatrix2fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix3fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix4fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UseProgram", "", [js.Object], [], false], ["ValidateProgram", "", [js.Object], [], false], ["VertexAttribPointer", "", [Go$Int, Go$Int, Go$Int, Go$Bool, Go$Int, Go$Int], [], false], ["Viewport", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false]];
	var DefaultAttributes = function() {
		return new ContextAttributes.Ptr(true, true, false, true, true, false);
	};
	var NewContext = function(canvas, ca) {
		var _map, _key, attrs, gl;
		if ((go$global.window.WebGLRenderingContext === undefined)) {
			return [(go$ptrType(Context)).nil, errors.New("Your browser doesn't appear to support webgl.")];
		}
		if (ca === (go$ptrType(ContextAttributes)).nil) {
			ca = DefaultAttributes();
		}
		attrs = (_map = new Go$Map(), _key = "alpha", _map[_key] = { k: _key, v: ca.Alpha }, _key = "depth", _map[_key] = { k: _key, v: ca.Depth }, _key = "stencil", _map[_key] = { k: _key, v: ca.Stencil }, _key = "antialias", _map[_key] = { k: _key, v: ca.Antialias }, _key = "premultipliedAlpha", _map[_key] = { k: _key, v: ca.PremultipliedAlpha }, _key = "preserveDrawingBuffer", _map[_key] = { k: _key, v: ca.PreserveDrawingBuffer }, _map);
		gl = canvas.getContext(go$externalize("webgl", Go$String), go$externalize(attrs, (go$mapType(Go$String, Go$Bool))));
		if ((gl === null)) {
			gl = canvas.getContext(go$externalize("experimental-webgl", Go$String), go$externalize(attrs, (go$mapType(Go$String, Go$Bool))));
			if ((gl === null)) {
				return [(go$ptrType(Context)).nil, errors.New("Creating a webgl context has failed.")];
			}
		}
		return [new Context.Ptr(gl), null];
	};
	Context.prototype.GetContextAttributes = function() { return this.go$val.GetContextAttributes(); };
	Context.Ptr.prototype.GetContextAttributes = function() {
		var c, ca;
		c = this;
		ca = c.Object.getContextAttributes();
		return new ContextAttributes.Ptr(!!(ca.alpha), !!(ca.depth), !!(ca.stencil), !!(ca.antialias), !!(ca.premultipliedAlpha), !!(ca.preservedDrawingBuffer));
	};
	Context.prototype.ActiveTexture = function(texture) { return this.go$val.ActiveTexture(texture); };
	Context.Ptr.prototype.ActiveTexture = function(texture) {
		var c;
		c = this;
		c.Object.activeTexture(texture);
	};
	Context.prototype.AttachShader = function(program, shader) { return this.go$val.AttachShader(program, shader); };
	Context.Ptr.prototype.AttachShader = function(program, shader) {
		var c;
		c = this;
		c.Object.attachShader(program, shader);
	};
	Context.prototype.BindAttribLocation = function(program, index, name) { return this.go$val.BindAttribLocation(program, index, name); };
	Context.Ptr.prototype.BindAttribLocation = function(program, index, name) {
		var c;
		c = this;
		c.Object.bindAttribLocation(program, index, go$externalize(name, Go$String));
	};
	Context.prototype.BindBuffer = function(target, buffer) { return this.go$val.BindBuffer(target, buffer); };
	Context.Ptr.prototype.BindBuffer = function(target, buffer) {
		var c;
		c = this;
		c.Object.bindBuffer(target, buffer);
	};
	Context.prototype.BindFramebuffer = function(target, framebuffer) { return this.go$val.BindFramebuffer(target, framebuffer); };
	Context.Ptr.prototype.BindFramebuffer = function(target, framebuffer) {
		var c;
		c = this;
		c.Object.bindFramebuffer(target, framebuffer);
	};
	Context.prototype.BindRenderbuffer = function(target, renderbuffer) { return this.go$val.BindRenderbuffer(target, renderbuffer); };
	Context.Ptr.prototype.BindRenderbuffer = function(target, renderbuffer) {
		var c;
		c = this;
		c.Object.bindRenderbuffer(target, renderbuffer);
	};
	Context.prototype.BindTexture = function(target, texture) { return this.go$val.BindTexture(target, texture); };
	Context.Ptr.prototype.BindTexture = function(target, texture) {
		var c;
		c = this;
		c.Object.bindTexture(target, texture);
	};
	Context.prototype.BlendColor = function(r, g, b, a) { return this.go$val.BlendColor(r, g, b, a); };
	Context.Ptr.prototype.BlendColor = function(r, g, b, a) {
		var c;
		c = this;
		c.Object.blendColor(r, g, b, a);
	};
	Context.prototype.BlendEquation = function(mode) { return this.go$val.BlendEquation(mode); };
	Context.Ptr.prototype.BlendEquation = function(mode) {
		var c;
		c = this;
		c.Object.blendEquation(mode);
	};
	Context.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) { return this.go$val.BlendEquationSeparate(modeRGB, modeAlpha); };
	Context.Ptr.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) {
		var c;
		c = this;
		c.Object.blendEquationSeparate(modeRGB, modeAlpha);
	};
	Context.prototype.BlendFunc = function(sfactor, dfactor) { return this.go$val.BlendFunc(sfactor, dfactor); };
	Context.Ptr.prototype.BlendFunc = function(sfactor, dfactor) {
		var c;
		c = this;
		c.Object.blendFunc(sfactor, dfactor);
	};
	Context.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) { return this.go$val.BlendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha); };
	Context.Ptr.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) {
		var c;
		c = this;
		c.Object.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha);
	};
	Context.prototype.BufferData = function(target, data, usage) { return this.go$val.BufferData(target, data, usage); };
	Context.Ptr.prototype.BufferData = function(target, data, usage) {
		var c;
		c = this;
		c.Object.bufferData(target, data, usage);
	};
	Context.prototype.BufferSubData = function(target, offset, data) { return this.go$val.BufferSubData(target, offset, data); };
	Context.Ptr.prototype.BufferSubData = function(target, offset, data) {
		var c;
		c = this;
		c.Object.bufferSubData(target, offset, data);
	};
	Context.prototype.CheckFramebufferStatus = function(target) { return this.go$val.CheckFramebufferStatus(target); };
	Context.Ptr.prototype.CheckFramebufferStatus = function(target) {
		var c;
		c = this;
		return (go$parseInt(c.Object.checkFramebufferStatus(target)) >> 0);
	};
	Context.prototype.Clear = function(flags) { return this.go$val.Clear(flags); };
	Context.Ptr.prototype.Clear = function(flags) {
		var c;
		c = this;
		c.Object.clear(flags);
	};
	Context.prototype.ClearColor = function(r, g, b, a) { return this.go$val.ClearColor(r, g, b, a); };
	Context.Ptr.prototype.ClearColor = function(r, g, b, a) {
		var c;
		c = this;
		c.Object.clearColor(r, g, b, a);
	};
	Context.prototype.ClearDepth = function(depth) { return this.go$val.ClearDepth(depth); };
	Context.Ptr.prototype.ClearDepth = function(depth) {
		var c;
		c = this;
		c.Object.clearDepth(depth);
	};
	Context.prototype.ClearStencil = function(s) { return this.go$val.ClearStencil(s); };
	Context.Ptr.prototype.ClearStencil = function(s) {
		var c;
		c = this;
		c.Object.clearStencil(s);
	};
	Context.prototype.ColorMask = function(r, g, b, a) { return this.go$val.ColorMask(r, g, b, a); };
	Context.Ptr.prototype.ColorMask = function(r, g, b, a) {
		var c;
		c = this;
		c.Object.colorMask(go$externalize(r, Go$Bool), go$externalize(g, Go$Bool), go$externalize(b, Go$Bool), go$externalize(a, Go$Bool));
	};
	Context.prototype.CompileShader = function(shader) { return this.go$val.CompileShader(shader); };
	Context.Ptr.prototype.CompileShader = function(shader) {
		var c;
		c = this;
		c.Object.compileShader(shader);
	};
	Context.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) { return this.go$val.CopyTexImage2D(target, level, internal, x, y, w, h, border); };
	Context.Ptr.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) {
		var c;
		c = this;
		c.Object.copyTexImage2D(target, level, internal, x, y, w, h, border);
	};
	Context.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) { return this.go$val.CopyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h); };
	Context.Ptr.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) {
		var c;
		c = this;
		c.Object.copyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h);
	};
	Context.prototype.CreateBuffer = function() { return this.go$val.CreateBuffer(); };
	Context.Ptr.prototype.CreateBuffer = function() {
		var c;
		c = this;
		return c.Object.createBuffer();
	};
	Context.prototype.CreateFramebuffer = function() { return this.go$val.CreateFramebuffer(); };
	Context.Ptr.prototype.CreateFramebuffer = function() {
		var c;
		c = this;
		return c.Object.createFramebuffer();
	};
	Context.prototype.CreateProgram = function() { return this.go$val.CreateProgram(); };
	Context.Ptr.prototype.CreateProgram = function() {
		var c;
		c = this;
		return c.Object.createProgram();
	};
	Context.prototype.CreateRenderbuffer = function() { return this.go$val.CreateRenderbuffer(); };
	Context.Ptr.prototype.CreateRenderbuffer = function() {
		var c;
		c = this;
		return c.Object.createRenderbuffer();
	};
	Context.prototype.CreateShader = function(typ) { return this.go$val.CreateShader(typ); };
	Context.Ptr.prototype.CreateShader = function(typ) {
		var c;
		c = this;
		return c.Object.createShader(typ);
	};
	Context.prototype.CreateTexture = function() { return this.go$val.CreateTexture(); };
	Context.Ptr.prototype.CreateTexture = function() {
		var c;
		c = this;
		return c.Object.createTexture();
	};
	Context.prototype.CullFace = function(mode) { return this.go$val.CullFace(mode); };
	Context.Ptr.prototype.CullFace = function(mode) {
		var c;
		c = this;
		c.Object.cullFace(mode);
	};
	Context.prototype.DeleteBuffer = function(buffer) { return this.go$val.DeleteBuffer(buffer); };
	Context.Ptr.prototype.DeleteBuffer = function(buffer) {
		var c;
		c = this;
		c.Object.deleteBuffer(buffer);
	};
	Context.prototype.DeleteFramebuffer = function(framebuffer) { return this.go$val.DeleteFramebuffer(framebuffer); };
	Context.Ptr.prototype.DeleteFramebuffer = function(framebuffer) {
		var c;
		c = this;
		c.Object.deleteFramebuffer(framebuffer);
	};
	Context.prototype.DeleteProgram = function(program) { return this.go$val.DeleteProgram(program); };
	Context.Ptr.prototype.DeleteProgram = function(program) {
		var c;
		c = this;
		c.Object.deleteProgram(program);
	};
	Context.prototype.DeleteRenderbuffer = function(renderbuffer) { return this.go$val.DeleteRenderbuffer(renderbuffer); };
	Context.Ptr.prototype.DeleteRenderbuffer = function(renderbuffer) {
		var c;
		c = this;
		c.Object.deleteRenderbuffer(renderbuffer);
	};
	Context.prototype.DeleteShader = function(shader) { return this.go$val.DeleteShader(shader); };
	Context.Ptr.prototype.DeleteShader = function(shader) {
		var c;
		c = this;
		c.Object.deleteShader(shader);
	};
	Context.prototype.DeleteTexture = function(texture) { return this.go$val.DeleteTexture(texture); };
	Context.Ptr.prototype.DeleteTexture = function(texture) {
		var c;
		c = this;
		c.Object.deleteTexture(texture);
	};
	Context.prototype.DepthFunc = function(fun) { return this.go$val.DepthFunc(fun); };
	Context.Ptr.prototype.DepthFunc = function(fun) {
		var c;
		c = this;
		c.Object.depthFunc(fun);
	};
	Context.prototype.DepthMask = function(flag) { return this.go$val.DepthMask(flag); };
	Context.Ptr.prototype.DepthMask = function(flag) {
		var c;
		c = this;
		c.Object.depthMask(go$externalize(flag, Go$Bool));
	};
	Context.prototype.DepthRange = function(zNear, zFar) { return this.go$val.DepthRange(zNear, zFar); };
	Context.Ptr.prototype.DepthRange = function(zNear, zFar) {
		var c;
		c = this;
		c.Object.depthRange(zNear, zFar);
	};
	Context.prototype.DetachShader = function(program, shader) { return this.go$val.DetachShader(program, shader); };
	Context.Ptr.prototype.DetachShader = function(program, shader) {
		var c;
		c = this;
		c.Object.detachShader(program, shader);
	};
	Context.prototype.Disable = function(cap) { return this.go$val.Disable(cap); };
	Context.Ptr.prototype.Disable = function(cap) {
		var c;
		c = this;
		c.Object.disable(cap);
	};
	Context.prototype.DisableVertexAttribArray = function(index) { return this.go$val.DisableVertexAttribArray(index); };
	Context.Ptr.prototype.DisableVertexAttribArray = function(index) {
		var c;
		c = this;
		c.Object.disableVertexAttribArray(index);
	};
	Context.prototype.DrawArrays = function(mode, first, count) { return this.go$val.DrawArrays(mode, first, count); };
	Context.Ptr.prototype.DrawArrays = function(mode, first, count) {
		var c;
		c = this;
		c.Object.drawArrays(mode, first, count);
	};
	Context.prototype.DrawElements = function(mode, count, typ, offset) { return this.go$val.DrawElements(mode, count, typ, offset); };
	Context.Ptr.prototype.DrawElements = function(mode, count, typ, offset) {
		var c;
		c = this;
		c.Object.drawElements(mode, count, typ, offset);
	};
	Context.prototype.Enable = function(cap) { return this.go$val.Enable(cap); };
	Context.Ptr.prototype.Enable = function(cap) {
		var c;
		c = this;
		c.Object.enable(cap);
	};
	Context.prototype.EnableVertexAttribArray = function(index) { return this.go$val.EnableVertexAttribArray(index); };
	Context.Ptr.prototype.EnableVertexAttribArray = function(index) {
		var c;
		c = this;
		c.Object.enableVertexAttribArray(index);
	};
	Context.prototype.Finish = function() { return this.go$val.Finish(); };
	Context.Ptr.prototype.Finish = function() {
		var c;
		c = this;
		c.Object.finish();
	};
	Context.prototype.Flush = function() { return this.go$val.Flush(); };
	Context.Ptr.prototype.Flush = function() {
		var c;
		c = this;
		c.Object.flush();
	};
	Context.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) { return this.go$val.FrameBufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer); };
	Context.Ptr.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) {
		var c;
		c = this;
		c.Object.framebufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer);
	};
	Context.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) { return this.go$val.FramebufferTexture2D(target, attachment, textarget, texture, level); };
	Context.Ptr.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) {
		var c;
		c = this;
		c.Object.framebufferTexture2D(target, attachment, textarget, texture, level);
	};
	Context.prototype.FrontFace = function(mode) { return this.go$val.FrontFace(mode); };
	Context.Ptr.prototype.FrontFace = function(mode) {
		var c;
		c = this;
		c.Object.frontFace(mode);
	};
	Context.prototype.GenerateMipmap = function(target) { return this.go$val.GenerateMipmap(target); };
	Context.Ptr.prototype.GenerateMipmap = function(target) {
		var c;
		c = this;
		c.Object.generateMipmap(target);
	};
	Context.prototype.GetActiveAttrib = function(program, index) { return this.go$val.GetActiveAttrib(program, index); };
	Context.Ptr.prototype.GetActiveAttrib = function(program, index) {
		var c;
		c = this;
		return c.Object.getActiveAttrib(program, index);
	};
	Context.prototype.GetActiveUniform = function(program, index) { return this.go$val.GetActiveUniform(program, index); };
	Context.Ptr.prototype.GetActiveUniform = function(program, index) {
		var c;
		c = this;
		return c.Object.getActiveUniform(program, index);
	};
	Context.prototype.GetAttachedShaders = function(program) { return this.go$val.GetAttachedShaders(program); };
	Context.Ptr.prototype.GetAttachedShaders = function(program) {
		var c, objs, shaders, i, _slice, _index;
		c = this;
		objs = c.Object.getAttachedShaders(program);
		shaders = (go$sliceType(js.Object)).make(go$parseInt(objs.length), 0, function() { return null; });
		i = 0;
		while (i < go$parseInt(objs.length)) {
			_slice = shaders, _index = i, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = objs[i]) : go$throwRuntimeError("index out of range");
			i = (i + 1 >> 0);
		}
		return shaders;
	};
	Context.prototype.GetAttribLocation = function(program, name) { return this.go$val.GetAttribLocation(program, name); };
	Context.Ptr.prototype.GetAttribLocation = function(program, name) {
		var c;
		c = this;
		return (go$parseInt(c.Object.getAttribLocation(program, go$externalize(name, Go$String))) >> 0);
	};
	Context.prototype.GetBufferParameter = function(target, pname) { return this.go$val.GetBufferParameter(target, pname); };
	Context.Ptr.prototype.GetBufferParameter = function(target, pname) {
		var c;
		c = this;
		return c.Object.getBufferParameter(target, pname);
	};
	Context.prototype.GetParameter = function(pname) { return this.go$val.GetParameter(pname); };
	Context.Ptr.prototype.GetParameter = function(pname) {
		var c;
		c = this;
		return c.Object.getParameter(pname);
	};
	Context.prototype.GetError = function() { return this.go$val.GetError(); };
	Context.Ptr.prototype.GetError = function() {
		var c;
		c = this;
		return (go$parseInt(c.Object.getError()) >> 0);
	};
	Context.prototype.GetExtension = function(name) { return this.go$val.GetExtension(name); };
	Context.Ptr.prototype.GetExtension = function(name) {
		var c;
		c = this;
		return c.Object.getExtension(go$externalize(name, Go$String));
	};
	Context.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) { return this.go$val.GetFramebufferAttachmentParameter(target, attachment, pname); };
	Context.Ptr.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) {
		var c;
		c = this;
		return c.Object.getFramebufferAttachmentParameter(target, attachment, pname);
	};
	Context.prototype.GetProgramParameteri = function(program, pname) { return this.go$val.GetProgramParameteri(program, pname); };
	Context.Ptr.prototype.GetProgramParameteri = function(program, pname) {
		var c;
		c = this;
		return (go$parseInt(c.Object.getProgramParameter(program, pname)) >> 0);
	};
	Context.prototype.GetProgramParameterb = function(program, pname) { return this.go$val.GetProgramParameterb(program, pname); };
	Context.Ptr.prototype.GetProgramParameterb = function(program, pname) {
		var c;
		c = this;
		return !!(c.Object.getProgramParameter(program, pname));
	};
	Context.prototype.GetProgramInfoLog = function(program) { return this.go$val.GetProgramInfoLog(program); };
	Context.Ptr.prototype.GetProgramInfoLog = function(program) {
		var c;
		c = this;
		return go$internalize(c.Object.getProgramInfoLog(program), Go$String);
	};
	Context.prototype.GetRenderbufferParameter = function(target, pname) { return this.go$val.GetRenderbufferParameter(target, pname); };
	Context.Ptr.prototype.GetRenderbufferParameter = function(target, pname) {
		var c;
		c = this;
		return c.Object.getRenderbufferParameter(target, pname);
	};
	Context.prototype.GetShaderParameter = function(shader, pname) { return this.go$val.GetShaderParameter(shader, pname); };
	Context.Ptr.prototype.GetShaderParameter = function(shader, pname) {
		var c;
		c = this;
		return c.Object.getShaderParameter(shader, pname);
	};
	Context.prototype.GetShaderParameterb = function(shader, pname) { return this.go$val.GetShaderParameterb(shader, pname); };
	Context.Ptr.prototype.GetShaderParameterb = function(shader, pname) {
		var c;
		c = this;
		return !!(c.Object.getShaderParameter(shader, pname));
	};
	Context.prototype.GetShaderInfoLog = function(shader) { return this.go$val.GetShaderInfoLog(shader); };
	Context.Ptr.prototype.GetShaderInfoLog = function(shader) {
		var c;
		c = this;
		return go$internalize(c.Object.getShaderInfoLog(shader), Go$String);
	};
	Context.prototype.GetShaderSource = function(shader) { return this.go$val.GetShaderSource(shader); };
	Context.Ptr.prototype.GetShaderSource = function(shader) {
		var c;
		c = this;
		return go$internalize(c.Object.getShaderSource(shader), Go$String);
	};
	Context.prototype.GetSupportedExtensions = function() { return this.go$val.GetSupportedExtensions(); };
	Context.Ptr.prototype.GetSupportedExtensions = function() {
		var c, ext, extensions, i, _slice, _index;
		c = this;
		ext = c.Object.getSupportedExtensions();
		extensions = (go$sliceType(Go$String)).make(go$parseInt(ext.length), 0, function() { return ""; });
		i = 0;
		while (i < go$parseInt(ext.length)) {
			_slice = extensions, _index = i, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = go$internalize(ext[i], Go$String)) : go$throwRuntimeError("index out of range");
			i = (i + 1 >> 0);
		}
		return extensions;
	};
	Context.prototype.GetTexParameter = function(target, pname) { return this.go$val.GetTexParameter(target, pname); };
	Context.Ptr.prototype.GetTexParameter = function(target, pname) {
		var c;
		c = this;
		return c.Object.getTexParameter(target, pname);
	};
	Context.prototype.GetUniform = function(program, location) { return this.go$val.GetUniform(program, location); };
	Context.Ptr.prototype.GetUniform = function(program, location) {
		var c;
		c = this;
		return c.Object.getUniform(program, location);
	};
	Context.prototype.GetUniformLocation = function(program, name) { return this.go$val.GetUniformLocation(program, name); };
	Context.Ptr.prototype.GetUniformLocation = function(program, name) {
		var c;
		c = this;
		return c.Object.getUniformLocation(program, go$externalize(name, Go$String));
	};
	Context.prototype.GetVertexAttrib = function(index, pname) { return this.go$val.GetVertexAttrib(index, pname); };
	Context.Ptr.prototype.GetVertexAttrib = function(index, pname) {
		var c;
		c = this;
		return c.Object.getVertexAttrib(index, pname);
	};
	Context.prototype.GetVertexAttribOffset = function(index, pname) { return this.go$val.GetVertexAttribOffset(index, pname); };
	Context.Ptr.prototype.GetVertexAttribOffset = function(index, pname) {
		var c;
		c = this;
		return (go$parseInt(c.Object.getVertexAttribOffset(index, pname)) >> 0);
	};
	Context.prototype.IsBuffer = function(buffer) { return this.go$val.IsBuffer(buffer); };
	Context.Ptr.prototype.IsBuffer = function(buffer) {
		var c;
		c = this;
		return !!(c.Object.isBuffer(buffer));
	};
	Context.prototype.IsContextLost = function() { return this.go$val.IsContextLost(); };
	Context.Ptr.prototype.IsContextLost = function() {
		var c;
		c = this;
		return !!(c.Object.isContextLost());
	};
	Context.prototype.IsFramebuffer = function(framebuffer) { return this.go$val.IsFramebuffer(framebuffer); };
	Context.Ptr.prototype.IsFramebuffer = function(framebuffer) {
		var c;
		c = this;
		return !!(c.Object.isFramebuffer(framebuffer));
	};
	Context.prototype.IsProgram = function(program) { return this.go$val.IsProgram(program); };
	Context.Ptr.prototype.IsProgram = function(program) {
		var c;
		c = this;
		return !!(c.Object.isProgram(program));
	};
	Context.prototype.IsRenderbuffer = function(renderbuffer) { return this.go$val.IsRenderbuffer(renderbuffer); };
	Context.Ptr.prototype.IsRenderbuffer = function(renderbuffer) {
		var c;
		c = this;
		return !!(c.Object.isRenderbuffer(renderbuffer));
	};
	Context.prototype.IsShader = function(shader) { return this.go$val.IsShader(shader); };
	Context.Ptr.prototype.IsShader = function(shader) {
		var c;
		c = this;
		return !!(c.Object.isShader(shader));
	};
	Context.prototype.IsTexture = function(texture) { return this.go$val.IsTexture(texture); };
	Context.Ptr.prototype.IsTexture = function(texture) {
		var c;
		c = this;
		return !!(c.Object.isTexture(texture));
	};
	Context.prototype.IsEnabled = function(capability) { return this.go$val.IsEnabled(capability); };
	Context.Ptr.prototype.IsEnabled = function(capability) {
		var c;
		c = this;
		return !!(c.Object.isEnabled(capability));
	};
	Context.prototype.LineWidth = function(width) { return this.go$val.LineWidth(width); };
	Context.Ptr.prototype.LineWidth = function(width) {
		var c;
		c = this;
		c.Object.lineWidth(width);
	};
	Context.prototype.LinkProgram = function(program) { return this.go$val.LinkProgram(program); };
	Context.Ptr.prototype.LinkProgram = function(program) {
		var c;
		c = this;
		c.Object.linkProgram(program);
	};
	Context.prototype.PixelStorei = function(pname, param) { return this.go$val.PixelStorei(pname, param); };
	Context.Ptr.prototype.PixelStorei = function(pname, param) {
		var c;
		c = this;
		c.Object.pixelStorei(pname, param);
	};
	Context.prototype.PolygonOffset = function(factor, units) { return this.go$val.PolygonOffset(factor, units); };
	Context.Ptr.prototype.PolygonOffset = function(factor, units) {
		var c;
		c = this;
		c.Object.polygonOffset(factor, units);
	};
	Context.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) { return this.go$val.ReadPixels(x, y, width, height, format, typ, pixels); };
	Context.Ptr.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) {
		var c;
		c = this;
		c.Object.readPixels(x, y, width, height, format, typ, pixels);
	};
	Context.prototype.RenderbufferStorage = function(target, internalFormat, width, height) { return this.go$val.RenderbufferStorage(target, internalFormat, width, height); };
	Context.Ptr.prototype.RenderbufferStorage = function(target, internalFormat, width, height) {
		var c;
		c = this;
		c.Object.renderbufferStorage(target, internalFormat, width, height);
	};
	Context.prototype.Scissor = function(x, y, width, height) { return this.go$val.Scissor(x, y, width, height); };
	Context.Ptr.prototype.Scissor = function(x, y, width, height) {
		var c;
		c = this;
		c.Object.scissor(x, y, width, height);
	};
	Context.prototype.ShaderSource = function(shader, source) { return this.go$val.ShaderSource(shader, source); };
	Context.Ptr.prototype.ShaderSource = function(shader, source) {
		var c;
		c = this;
		c.Object.shaderSource(shader, go$externalize(source, Go$String));
	};
	Context.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) { return this.go$val.TexImage2D(target, level, internalFormat, format, kind, image); };
	Context.Ptr.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) {
		var c;
		c = this;
		c.Object.texImage2D(target, level, internalFormat, format, kind, image);
	};
	Context.prototype.TexParameteri = function(target, pname, param) { return this.go$val.TexParameteri(target, pname, param); };
	Context.Ptr.prototype.TexParameteri = function(target, pname, param) {
		var c;
		c = this;
		c.Object.texParameteri(target, pname, param);
	};
	Context.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) { return this.go$val.TexSubImage2D(target, level, xoffset, yoffset, format, typ, image); };
	Context.Ptr.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) {
		var c;
		c = this;
		c.Object.texSubImage2D(target, level, xoffset, yoffset, format, typ, image);
	};
	Context.prototype.Uniform1f = function(location, x) { return this.go$val.Uniform1f(location, x); };
	Context.Ptr.prototype.Uniform1f = function(location, x) {
		var c;
		c = this;
		c.Object.uniform1f(location, x);
	};
	Context.prototype.Uniform1i = function(location, x) { return this.go$val.Uniform1i(location, x); };
	Context.Ptr.prototype.Uniform1i = function(location, x) {
		var c;
		c = this;
		c.Object.uniform1i(location, x);
	};
	Context.prototype.Uniform2f = function(location, x, y) { return this.go$val.Uniform2f(location, x, y); };
	Context.Ptr.prototype.Uniform2f = function(location, x, y) {
		var c;
		c = this;
		c.Object.uniform2f(location, x, y);
	};
	Context.prototype.Uniform2i = function(location, x, y) { return this.go$val.Uniform2i(location, x, y); };
	Context.Ptr.prototype.Uniform2i = function(location, x, y) {
		var c;
		c = this;
		c.Object.uniform2i(location, x, y);
	};
	Context.prototype.Uniform3f = function(location, x, y, z) { return this.go$val.Uniform3f(location, x, y, z); };
	Context.Ptr.prototype.Uniform3f = function(location, x, y, z) {
		var c;
		c = this;
		c.Object.uniform3f(location, x, y, z);
	};
	Context.prototype.Uniform3i = function(location, x, y, z) { return this.go$val.Uniform3i(location, x, y, z); };
	Context.Ptr.prototype.Uniform3i = function(location, x, y, z) {
		var c;
		c = this;
		c.Object.uniform3i(location, x, y, z);
	};
	Context.prototype.Uniform4f = function(location, x, y, z, w) { return this.go$val.Uniform4f(location, x, y, z, w); };
	Context.Ptr.prototype.Uniform4f = function(location, x, y, z, w) {
		var c;
		c = this;
		c.Object.uniform4f(location, x, y, z, w);
	};
	Context.prototype.Uniform4i = function(location, x, y, z, w) { return this.go$val.Uniform4i(location, x, y, z, w); };
	Context.Ptr.prototype.Uniform4i = function(location, x, y, z, w) {
		var c;
		c = this;
		c.Object.uniform4i(location, x, y, z, w);
	};
	Context.prototype.UniformMatrix2fv = function(location, transpose, value) { return this.go$val.UniformMatrix2fv(location, transpose, value); };
	Context.Ptr.prototype.UniformMatrix2fv = function(location, transpose, value) {
		var c;
		c = this;
		c.Object.uniformMatrix2fv(location, go$externalize(transpose, Go$Bool), go$externalize(value, (go$sliceType(Go$Float32))));
	};
	Context.prototype.UniformMatrix3fv = function(location, transpose, value) { return this.go$val.UniformMatrix3fv(location, transpose, value); };
	Context.Ptr.prototype.UniformMatrix3fv = function(location, transpose, value) {
		var c;
		c = this;
		c.Object.uniformMatrix3fv(location, go$externalize(transpose, Go$Bool), go$externalize(value, (go$sliceType(Go$Float32))));
	};
	Context.prototype.UniformMatrix4fv = function(location, transpose, value) { return this.go$val.UniformMatrix4fv(location, transpose, value); };
	Context.Ptr.prototype.UniformMatrix4fv = function(location, transpose, value) {
		var c;
		c = this;
		c.Object.uniformMatrix4fv(location, go$externalize(transpose, Go$Bool), go$externalize(value, (go$sliceType(Go$Float32))));
	};
	Context.prototype.UseProgram = function(program) { return this.go$val.UseProgram(program); };
	Context.Ptr.prototype.UseProgram = function(program) {
		var c;
		c = this;
		c.Object.useProgram(program);
	};
	Context.prototype.ValidateProgram = function(program) { return this.go$val.ValidateProgram(program); };
	Context.Ptr.prototype.ValidateProgram = function(program) {
		var c;
		c = this;
		c.Object.validateProgram(program);
	};
	Context.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) { return this.go$val.VertexAttribPointer(index, size, typ, normal, stride, offset); };
	Context.Ptr.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) {
		var c;
		c = this;
		c.Object.vertexAttribPointer(index, size, typ, go$externalize(normal, Go$Bool), stride, offset);
	};
	Context.prototype.Viewport = function(x, y, width, height) { return this.go$val.Viewport(x, y, width, height); };
	Context.Ptr.prototype.Viewport = function(x, y, width, height) {
		var c;
		c = this;
		c.Object.viewport(x, y, width, height);
	};
	go$pkg.ARRAY_BUFFER = 34962;
	go$pkg.ARRAY_BUFFER_BINDING = 34964;
	go$pkg.ATTACHED_SHADERS = 35717;
	go$pkg.BACK = 1029;
	go$pkg.BLEND = 3042;
	go$pkg.BLEND_COLOR = 32773;
	go$pkg.BLEND_DST_ALPHA = 32970;
	go$pkg.BLEND_DST_RGB = 32968;
	go$pkg.BLEND_EQUATION = 32777;
	go$pkg.BLEND_EQUATION_ALPHA = 34877;
	go$pkg.BLEND_EQUATION_RGB = 32777;
	go$pkg.BLEND_SRC_ALPHA = 32971;
	go$pkg.BLEND_SRC_RGB = 32969;
	go$pkg.BLUE_BITS = 3412;
	go$pkg.BOOL = 35670;
	go$pkg.BOOL_VEC2 = 35671;
	go$pkg.BOOL_VEC3 = 35672;
	go$pkg.BOOL_VEC4 = 35673;
	go$pkg.BROWSER_DEFAULT_WEBGL = 37444;
	go$pkg.BUFFER_SIZE = 34660;
	go$pkg.BUFFER_USAGE = 34661;
	go$pkg.BYTE = 5120;
	go$pkg.CCW = 2305;
	go$pkg.CLAMP_TO_EDGE = 33071;
	go$pkg.COLOR_ATTACHMENT0 = 36064;
	go$pkg.COLOR_BUFFER_BIT = 16384;
	go$pkg.COLOR_CLEAR_VALUE = 3106;
	go$pkg.COLOR_WRITEMASK = 3107;
	go$pkg.COMPILE_STATUS = 35713;
	go$pkg.COMPRESSED_TEXTURE_FORMATS = 34467;
	go$pkg.CONSTANT_ALPHA = 32771;
	go$pkg.CONSTANT_COLOR = 32769;
	go$pkg.CONTEXT_LOST_WEBGL = 37442;
	go$pkg.CULL_FACE = 2884;
	go$pkg.CULL_FACE_MODE = 2885;
	go$pkg.CURRENT_PROGRAM = 35725;
	go$pkg.CURRENT_VERTEX_ATTRIB = 34342;
	go$pkg.CW = 2304;
	go$pkg.DECR = 7683;
	go$pkg.DECR_WRAP = 34056;
	go$pkg.DELETE_STATUS = 35712;
	go$pkg.DEPTH_ATTACHMENT = 36096;
	go$pkg.DEPTH_BITS = 3414;
	go$pkg.DEPTH_BUFFER_BIT = 256;
	go$pkg.DEPTH_CLEAR_VALUE = 2931;
	go$pkg.DEPTH_COMPONENT = 6402;
	go$pkg.DEPTH_COMPONENT16 = 33189;
	go$pkg.DEPTH_FUNC = 2932;
	go$pkg.DEPTH_RANGE = 2928;
	go$pkg.DEPTH_STENCIL = 34041;
	go$pkg.DEPTH_STENCIL_ATTACHMENT = 33306;
	go$pkg.DEPTH_TEST = 2929;
	go$pkg.DEPTH_WRITEMASK = 2930;
	go$pkg.DITHER = 3024;
	go$pkg.DONT_CARE = 4352;
	go$pkg.DST_ALPHA = 772;
	go$pkg.DST_COLOR = 774;
	go$pkg.DYNAMIC_DRAW = 35048;
	go$pkg.ELEMENT_ARRAY_BUFFER = 34963;
	go$pkg.ELEMENT_ARRAY_BUFFER_BINDING = 34965;
	go$pkg.EQUAL = 514;
	go$pkg.FASTEST = 4353;
	go$pkg.FLOAT = 5126;
	go$pkg.FLOAT_MAT2 = 35674;
	go$pkg.FLOAT_MAT3 = 35675;
	go$pkg.FLOAT_MAT4 = 35676;
	go$pkg.FLOAT_VEC2 = 35664;
	go$pkg.FLOAT_VEC3 = 35665;
	go$pkg.FLOAT_VEC4 = 35666;
	go$pkg.FRAGMENT_SHADER = 35632;
	go$pkg.FRAMEBUFFER = 36160;
	go$pkg.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME = 36049;
	go$pkg.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE = 36048;
	go$pkg.FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE = 36051;
	go$pkg.FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL = 36050;
	go$pkg.FRAMEBUFFER_BINDING = 36006;
	go$pkg.FRAMEBUFFER_COMPLETE = 36053;
	go$pkg.FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 36054;
	go$pkg.FRAMEBUFFER_INCOMPLETE_DIMENSIONS = 36057;
	go$pkg.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = 36055;
	go$pkg.FRAMEBUFFER_UNSUPPORTED = 36061;
	go$pkg.FRONT = 1028;
	go$pkg.FRONT_AND_BACK = 1032;
	go$pkg.FRONT_FACE = 2886;
	go$pkg.FUNC_ADD = 32774;
	go$pkg.FUNC_REVERSE_SUBTRACT = 32779;
	go$pkg.FUNC_SUBTRACT = 32778;
	go$pkg.GENERATE_MIPMAP_HINT = 33170;
	go$pkg.GEQUAL = 518;
	go$pkg.GREATER = 516;
	go$pkg.GREEN_BITS = 3411;
	go$pkg.HIGH_FLOAT = 36338;
	go$pkg.HIGH_INT = 36341;
	go$pkg.INCR = 7682;
	go$pkg.INCR_WRAP = 34055;
	go$pkg.INFO_LOG_LENGTH = 35716;
	go$pkg.INT = 5124;
	go$pkg.INT_VEC2 = 35667;
	go$pkg.INT_VEC3 = 35668;
	go$pkg.INT_VEC4 = 35669;
	go$pkg.INVALID_ENUM = 1280;
	go$pkg.INVALID_FRAMEBUFFER_OPERATION = 1286;
	go$pkg.INVALID_OPERATION = 1282;
	go$pkg.INVALID_VALUE = 1281;
	go$pkg.INVERT = 5386;
	go$pkg.KEEP = 7680;
	go$pkg.LEQUAL = 515;
	go$pkg.LESS = 513;
	go$pkg.LINEAR = 9729;
	go$pkg.LINEAR_MIPMAP_LINEAR = 9987;
	go$pkg.LINEAR_MIPMAP_NEAREST = 9985;
	go$pkg.LINES = 1;
	go$pkg.LINE_LOOP = 2;
	go$pkg.LINE_STRIP = 3;
	go$pkg.LINE_WIDTH = 2849;
	go$pkg.LINK_STATUS = 35714;
	go$pkg.LOW_FLOAT = 36336;
	go$pkg.LOW_INT = 36339;
	go$pkg.LUMINANCE = 6409;
	go$pkg.LUMINANCE_ALPHA = 6410;
	go$pkg.MAX_COMBINED_TEXTURE_IMAGE_UNITS = 35661;
	go$pkg.MAX_CUBE_MAP_TEXTURE_SIZE = 34076;
	go$pkg.MAX_FRAGMENT_UNIFORM_VECTORS = 36349;
	go$pkg.MAX_RENDERBUFFER_SIZE = 34024;
	go$pkg.MAX_TEXTURE_IMAGE_UNITS = 34930;
	go$pkg.MAX_TEXTURE_SIZE = 3379;
	go$pkg.MAX_VARYING_VECTORS = 36348;
	go$pkg.MAX_VERTEX_ATTRIBS = 34921;
	go$pkg.MAX_VERTEX_TEXTURE_IMAGE_UNITS = 35660;
	go$pkg.MAX_VERTEX_UNIFORM_VECTORS = 36347;
	go$pkg.MAX_VIEWPORT_DIMS = 3386;
	go$pkg.MEDIUM_FLOAT = 36337;
	go$pkg.MEDIUM_INT = 36340;
	go$pkg.MIRRORED_REPEAT = 33648;
	go$pkg.NEAREST = 9728;
	go$pkg.NEAREST_MIPMAP_LINEAR = 9986;
	go$pkg.NEAREST_MIPMAP_NEAREST = 9984;
	go$pkg.NEVER = 512;
	go$pkg.NICEST = 4354;
	go$pkg.NONE = 0;
	go$pkg.NOTEQUAL = 517;
	go$pkg.NO_ERROR = 0;
	go$pkg.NUM_COMPRESSED_TEXTURE_FORMATS = 34466;
	go$pkg.ONE = 1;
	go$pkg.ONE_MINUS_CONSTANT_ALPHA = 32772;
	go$pkg.ONE_MINUS_CONSTANT_COLOR = 32770;
	go$pkg.ONE_MINUS_DST_ALPHA = 773;
	go$pkg.ONE_MINUS_DST_COLOR = 775;
	go$pkg.ONE_MINUS_SRC_ALPHA = 771;
	go$pkg.ONE_MINUS_SRC_COLOR = 769;
	go$pkg.OUT_OF_MEMORY = 1285;
	go$pkg.PACK_ALIGNMENT = 3333;
	go$pkg.POINTS = 0;
	go$pkg.POLYGON_OFFSET_FACTOR = 32824;
	go$pkg.POLYGON_OFFSET_FILL = 32823;
	go$pkg.POLYGON_OFFSET_UNITS = 10752;
	go$pkg.RED_BITS = 3410;
	go$pkg.RENDERBUFFER = 36161;
	go$pkg.RENDERBUFFER_ALPHA_SIZE = 36179;
	go$pkg.RENDERBUFFER_BINDING = 36007;
	go$pkg.RENDERBUFFER_BLUE_SIZE = 36178;
	go$pkg.RENDERBUFFER_DEPTH_SIZE = 36180;
	go$pkg.RENDERBUFFER_GREEN_SIZE = 36177;
	go$pkg.RENDERBUFFER_HEIGHT = 36163;
	go$pkg.RENDERBUFFER_INTERNAL_FORMAT = 36164;
	go$pkg.RENDERBUFFER_RED_SIZE = 36176;
	go$pkg.RENDERBUFFER_STENCIL_SIZE = 36181;
	go$pkg.RENDERBUFFER_WIDTH = 36162;
	go$pkg.RENDERER = 7937;
	go$pkg.REPEAT = 10497;
	go$pkg.REPLACE = 7681;
	go$pkg.RGB = 6407;
	go$pkg.RGB5_A1 = 32855;
	go$pkg.RGB565 = 36194;
	go$pkg.RGBA = 6408;
	go$pkg.RGBA4 = 32854;
	go$pkg.SAMPLER_2D = 35678;
	go$pkg.SAMPLER_CUBE = 35680;
	go$pkg.SAMPLES = 32937;
	go$pkg.SAMPLE_ALPHA_TO_COVERAGE = 32926;
	go$pkg.SAMPLE_BUFFERS = 32936;
	go$pkg.SAMPLE_COVERAGE = 32928;
	go$pkg.SAMPLE_COVERAGE_INVERT = 32939;
	go$pkg.SAMPLE_COVERAGE_VALUE = 32938;
	go$pkg.SCISSOR_BOX = 3088;
	go$pkg.SCISSOR_TEST = 3089;
	go$pkg.SHADER_COMPILER = 36346;
	go$pkg.SHADER_SOURCE_LENGTH = 35720;
	go$pkg.SHADER_TYPE = 35663;
	go$pkg.SHADING_LANGUAGE_VERSION = 35724;
	go$pkg.SHORT = 5122;
	go$pkg.SRC_ALPHA = 770;
	go$pkg.SRC_ALPHA_SATURATE = 776;
	go$pkg.SRC_COLOR = 768;
	go$pkg.STATIC_DRAW = 35044;
	go$pkg.STENCIL_ATTACHMENT = 36128;
	go$pkg.STENCIL_BACK_FAIL = 34817;
	go$pkg.STENCIL_BACK_FUNC = 34816;
	go$pkg.STENCIL_BACK_PASS_DEPTH_FAIL = 34818;
	go$pkg.STENCIL_BACK_PASS_DEPTH_PASS = 34819;
	go$pkg.STENCIL_BACK_REF = 36003;
	go$pkg.STENCIL_BACK_VALUE_MASK = 36004;
	go$pkg.STENCIL_BACK_WRITEMASK = 36005;
	go$pkg.STENCIL_BITS = 3415;
	go$pkg.STENCIL_BUFFER_BIT = 1024;
	go$pkg.STENCIL_CLEAR_VALUE = 2961;
	go$pkg.STENCIL_FAIL = 2964;
	go$pkg.STENCIL_FUNC = 2962;
	go$pkg.STENCIL_INDEX = 6401;
	go$pkg.STENCIL_INDEX8 = 36168;
	go$pkg.STENCIL_PASS_DEPTH_FAIL = 2965;
	go$pkg.STENCIL_PASS_DEPTH_PASS = 2966;
	go$pkg.STENCIL_REF = 2967;
	go$pkg.STENCIL_TEST = 2960;
	go$pkg.STENCIL_VALUE_MASK = 2963;
	go$pkg.STENCIL_WRITEMASK = 2968;
	go$pkg.STREAM_DRAW = 35040;
	go$pkg.SUBPIXEL_BITS = 3408;
	go$pkg.TEXTURE = 5890;
	go$pkg.TEXTURE0 = 33984;
	go$pkg.TEXTURE1 = 33985;
	go$pkg.TEXTURE2 = 33986;
	go$pkg.TEXTURE3 = 33987;
	go$pkg.TEXTURE4 = 33988;
	go$pkg.TEXTURE5 = 33989;
	go$pkg.TEXTURE6 = 33990;
	go$pkg.TEXTURE7 = 33991;
	go$pkg.TEXTURE8 = 33992;
	go$pkg.TEXTURE9 = 33993;
	go$pkg.TEXTURE10 = 33994;
	go$pkg.TEXTURE11 = 33995;
	go$pkg.TEXTURE12 = 33996;
	go$pkg.TEXTURE13 = 33997;
	go$pkg.TEXTURE14 = 33998;
	go$pkg.TEXTURE15 = 33999;
	go$pkg.TEXTURE16 = 34000;
	go$pkg.TEXTURE17 = 34001;
	go$pkg.TEXTURE18 = 34002;
	go$pkg.TEXTURE19 = 34003;
	go$pkg.TEXTURE20 = 34004;
	go$pkg.TEXTURE21 = 34005;
	go$pkg.TEXTURE22 = 34006;
	go$pkg.TEXTURE23 = 34007;
	go$pkg.TEXTURE24 = 34008;
	go$pkg.TEXTURE25 = 34009;
	go$pkg.TEXTURE26 = 34010;
	go$pkg.TEXTURE27 = 34011;
	go$pkg.TEXTURE28 = 34012;
	go$pkg.TEXTURE29 = 34013;
	go$pkg.TEXTURE30 = 34014;
	go$pkg.TEXTURE31 = 34015;
	go$pkg.TEXTURE_2D = 3553;
	go$pkg.TEXTURE_BINDING_2D = 32873;
	go$pkg.TEXTURE_BINDING_CUBE_MAP = 34068;
	go$pkg.TEXTURE_CUBE_MAP = 34067;
	go$pkg.TEXTURE_CUBE_MAP_NEGATIVE_X = 34070;
	go$pkg.TEXTURE_CUBE_MAP_NEGATIVE_Y = 34072;
	go$pkg.TEXTURE_CUBE_MAP_NEGATIVE_Z = 34074;
	go$pkg.TEXTURE_CUBE_MAP_POSITIVE_X = 34069;
	go$pkg.TEXTURE_CUBE_MAP_POSITIVE_Y = 34071;
	go$pkg.TEXTURE_CUBE_MAP_POSITIVE_Z = 34073;
	go$pkg.TEXTURE_MAG_FILTER = 10240;
	go$pkg.TEXTURE_MIN_FILTER = 10241;
	go$pkg.TEXTURE_WRAP_S = 10242;
	go$pkg.TEXTURE_WRAP_T = 10243;
	go$pkg.TRIANGLES = 4;
	go$pkg.TRIANGLE_FAN = 6;
	go$pkg.TRIANGLE_STRIP = 5;
	go$pkg.UNPACK_ALIGNMENT = 3317;
	go$pkg.UNPACK_COLORSPACE_CONVERSION_WEBGL = 37443;
	go$pkg.UNPACK_FLIP_Y_WEBGL = 37440;
	go$pkg.UNPACK_PREMULTIPLY_ALPHA_WEBGL = 37441;
	go$pkg.UNSIGNED_BYTE = 5121;
	go$pkg.UNSIGNED_INT = 5125;
	go$pkg.UNSIGNED_SHORT = 5123;
	go$pkg.UNSIGNED_SHORT_4_4_4_4 = 32819;
	go$pkg.UNSIGNED_SHORT_5_5_5_1 = 32820;
	go$pkg.UNSIGNED_SHORT_5_6_5 = 33635;
	go$pkg.VALIDATE_STATUS = 35715;
	go$pkg.VENDOR = 7936;
	go$pkg.VERSION = 7938;
	go$pkg.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING = 34975;
	go$pkg.VERTEX_ATTRIB_ARRAY_ENABLED = 34338;
	go$pkg.VERTEX_ATTRIB_ARRAY_NORMALIZED = 34922;
	go$pkg.VERTEX_ATTRIB_ARRAY_POINTER = 34373;
	go$pkg.VERTEX_ATTRIB_ARRAY_SIZE = 34339;
	go$pkg.VERTEX_ATTRIB_ARRAY_STRIDE = 34340;
	go$pkg.VERTEX_ATTRIB_ARRAY_TYPE = 34341;
	go$pkg.VERTEX_SHADER = 35633;
	go$pkg.VIEWPORT = 2978;
	go$pkg.ZERO = 0;
	go$pkg.DefaultAttributes = DefaultAttributes;
	go$pkg.NewContext = NewContext;
	go$pkg.init = function() {
	};
  return go$pkg;
})();
go$packages["math"] = (function() {
  var go$pkg = {};
	var Abs = function(x) {
		throw go$panic("Native function not implemented: Abs");
	};
	var abs = function(x) {
		if (x < 0) {
			return -x;
		} else if (x === 0) {
			return 0;
		}
		return x;
	};
	var Acosh = function(x) {
		var t;
		if (x < 1 || IsNaN(x)) {
			return NaN();
		} else if (x === 1) {
			return 0;
		} else if (x >= 2.68435456e+08) {
			return Log(x) + 0.6931471805599453;
		} else if (x > 2) {
			return Log(2 * x - 1 / (x + Sqrt(x * x - 1)));
		}
		t = x - 1;
		return Log1p(t + Sqrt(2 * t + t * t));
	};
	var Asin = function(x) {
		throw go$panic("Native function not implemented: Asin");
	};
	var asin = function(x) {
		var sign, temp;
		if (x === 0) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x > 1) {
			return NaN();
		}
		temp = Sqrt(1 - x * x);
		if (x > 0.7) {
			temp = 1.5707963267948966 - satan(temp / x);
		} else {
			temp = satan(x / temp);
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Acos = function(x) {
		throw go$panic("Native function not implemented: Acos");
	};
	var acos = function(x) {
		return 1.5707963267948966 - Asin(x);
	};
	var Asinh = function(x) {
		var sign, temp;
		if (IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		if (x > 2.68435456e+08) {
			temp = Log(x) + 0.6931471805599453;
		} else if (x > 2) {
			temp = Log(2 * x + 1 / (Sqrt(x * x + 1) + x));
		} else if (x < 3.725290298461914e-09) {
			temp = x;
		} else {
			temp = Log1p(x + x * x / (1 + Sqrt(1 + x * x)));
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var xatan = function(x) {
		var z;
		z = x * x;
		z = z * ((((-0.8750608600031904 * z + -16.157537187333652) * z + -75.00855792314705) * z + -122.88666844901361) * z + -64.85021904942025) / (((((z + 24.858464901423062) * z + 165.02700983169885) * z + 432.88106049129027) * z + 485.3903996359137) * z + 194.5506571482614);
		z = x * z + x;
		return z;
	};
	var satan = function(x) {
		if (x <= 0.66) {
			return xatan(x);
		}
		if (x > 2.414213562373095) {
			return 1.5707963267948966 - xatan(1 / x) + 6.123233995736766e-17;
		}
		return 0.7853981633974483 + xatan((x - 1) / (x + 1)) + 3.061616997868383e-17;
	};
	var Atan = function(x) {
		throw go$panic("Native function not implemented: Atan");
	};
	var atan = function(x) {
		if (x === 0) {
			return x;
		}
		if (x > 0) {
			return satan(x);
		}
		return -satan(-x);
	};
	var Atan2 = function(y, x) {
		throw go$panic("Native function not implemented: Atan2");
	};
	var atan2 = function(y, x) {
		var q;
		if (IsNaN(y) || IsNaN(x)) {
			return NaN();
		} else if (y === 0) {
			if (x >= 0 && !Signbit(x)) {
				return Copysign(0, y);
			}
			return Copysign(3.141592653589793, y);
		} else if (x === 0) {
			return Copysign(1.5707963267948966, y);
		} else if (IsInf(x, 0)) {
			if (IsInf(x, 1)) {
				if (IsInf(y, 0)) {
					return Copysign(0.7853981633974483, y);
				} else {
					return Copysign(0, y);
				}
			}
			if (IsInf(y, 0)) {
				return Copysign(2.356194490192345, y);
			} else {
				return Copysign(3.141592653589793, y);
			}
		} else if (IsInf(y, 0)) {
			return Copysign(1.5707963267948966, y);
		}
		q = Atan(y / x);
		if (x < 0) {
			if (q <= 0) {
				return q + 3.141592653589793;
			}
			return q - 3.141592653589793;
		}
		return q;
	};
	var Atanh = function(x) {
		var sign, temp;
		if (x < -1 || x > 1 || IsNaN(x)) {
			return NaN();
		} else if (x === 1) {
			return Inf(1);
		} else if (x === -1) {
			return Inf(-1);
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		if (x < 3.725290298461914e-09) {
			temp = x;
		} else if (x < 0.5) {
			temp = x + x;
			temp = 0.5 * Log1p(temp + temp * x / (1 - x));
		} else {
			temp = 0.5 * Log1p((x + x) / (1 - x));
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Inf = function(sign) {
		var v;
		v = new Go$Uint64(0, 0);
		if (sign >= 0) {
			v = new Go$Uint64(2146435072, 0);
		} else {
			v = new Go$Uint64(4293918720, 0);
		}
		return Float64frombits(v);
	};
	var NaN = function() {
		return Float64frombits(new Go$Uint64(2146959360, 1));
	};
	var IsNaN = function(f) {
		var is;
		is = false;
		is = !(f === f);
		return is;
	};
	var IsInf = function(f, sign) {
		return sign >= 0 && f > 1.7976931348623157e+308 || sign <= 0 && f < -1.7976931348623157e+308;
	};
	var normalize = function(x) {
		var y, exp$1, _tuple, _tuple$1;
		y = 0;
		exp$1 = 0;
		if (Abs(x) < 2.2250738585072014e-308) {
			_tuple = [x * 4.503599627370496e+15, -52], y = _tuple[0], exp$1 = _tuple[1];
			return [y, exp$1];
		}
		_tuple$1 = [x, 0], y = _tuple$1[0], exp$1 = _tuple$1[1];
		return [y, exp$1];
	};
	var Cbrt = function(x) {
		var sign, _tuple, f, e, _r, m, _ref, _q, y, s, t;
		if (x === 0 || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		_tuple = Frexp(x), f = _tuple[0], e = _tuple[1];
		m = (_r = e % 3, _r === _r ? _r : go$throwRuntimeError("integer divide by zero"));
		if (m > 0) {
			m = (m - 3 >> 0);
			e = (e - (m) >> 0);
		}
		_ref = m;
		if (_ref === 0) {
			f = 0.1662848358 * f + 1.096040958 - 0.4105032829 / (0.5649335816 + f);
		} else if (_ref === -1) {
			f = f * 0.5;
			f = 0.2639607233 * f + 0.8699282849 - 0.1629083358 / (0.2824667908 + f);
		} else {
			f = f * 0.25;
			f = 0.4190115298 * f + 0.6904625373 - 0.0646502159 / (0.1412333954 + f);
		}
		y = Ldexp(f, (_q = e / 3, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")));
		s = y * y * y;
		t = s + x;
		y = y * ((t + x) / (s + t));
		s = (y * y * y - x) / x;
		y = y - (y * ((0.1728395061728395 * s - 0.2222222222222222) * s + 0.3333333333333333) * s);
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Copysign = function(x, y) {
		var x$1, x$2, x$3, x$4;
		return Float64frombits((x$1 = (x$2 = Float64bits(x), new Go$Uint64(x$2.high &~ 2147483648, (x$2.low &~ 0) >>> 0)), x$3 = (x$4 = Float64bits(y), new Go$Uint64(x$4.high & 2147483648, (x$4.low & 0) >>> 0)), new Go$Uint64(x$1.high | x$3.high, (x$1.low | x$3.low) >>> 0)));
	};
	var Dim = function(x, y) {
		throw go$panic("Native function not implemented: Dim");
	};
	var dim = function(x, y) {
		return max(x - y, 0);
	};
	var Max = function(x, y) {
		throw go$panic("Native function not implemented: Max");
	};
	var max = function(x, y) {
		if (IsInf(x, 1) || IsInf(y, 1)) {
			return Inf(1);
		} else if (IsNaN(x) || IsNaN(y)) {
			return NaN();
		} else if (x === 0 && x === y) {
			if (Signbit(x)) {
				return y;
			}
			return x;
		}
		if (x > y) {
			return x;
		}
		return y;
	};
	var Min = function(x, y) {
		throw go$panic("Native function not implemented: Min");
	};
	var min = function(x, y) {
		if (IsInf(x, -1) || IsInf(y, -1)) {
			return Inf(-1);
		} else if (IsNaN(x) || IsNaN(y)) {
			return NaN();
		} else if (x === 0 && x === y) {
			if (Signbit(x)) {
				return x;
			}
			return y;
		}
		if (x < y) {
			return x;
		}
		return y;
	};
	var Erf = function(x) {
		var sign, temp, z, r, s, y, s$1, P, Q, s$2, R, S, x$1, z$1, r$1;
		if (IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 1;
		} else if (IsInf(x, -1)) {
			return -1;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x < 0.84375) {
			temp = 0;
			if (x < 3.725290298461914e-09) {
				if (x < 2.848094538889218e-306) {
					temp = 0.125 * (8 * x + 1.0270333367641007 * x);
				} else {
					temp = x + 0.1283791670955126 * x;
				}
			} else {
				z = x * x;
				r = 0.12837916709551256 + z * (-0.3250421072470015 + z * (-0.02848174957559851 + z * (-0.005770270296489442 + z * -2.3763016656650163e-05)));
				s = 1 + z * (0.39791722395915535 + z * (0.0650222499887673 + z * (0.005081306281875766 + z * (0.00013249473800432164 + z * -3.960228278775368e-06))));
				y = r / s;
				temp = x + x * y;
			}
			if (sign) {
				return -temp;
			}
			return temp;
		}
		if (x < 1.25) {
			s$1 = x - 1;
			P = -0.0023621185607526594 + s$1 * (0.41485611868374833 + s$1 * (-0.3722078760357013 + s$1 * (0.31834661990116175 + s$1 * (-0.11089469428239668 + s$1 * (0.035478304325618236 + s$1 * -0.002166375594868791)))));
			Q = 1 + s$1 * (0.10642088040084423 + s$1 * (0.540397917702171 + s$1 * (0.07182865441419627 + s$1 * (0.12617121980876164 + s$1 * (0.01363708391202905 + s$1 * 0.011984499846799107)))));
			if (sign) {
				return -0.8450629115104675 - P / Q;
			}
			return 0.8450629115104675 + P / Q;
		}
		if (x >= 6) {
			if (sign) {
				return -1;
			}
			return 1;
		}
		s$2 = 1 / (x * x);
		R = 0, S = 0;
		if (x < 2.857142857142857) {
			R = -0.009864944034847148 + s$2 * (-0.6938585727071818 + s$2 * (-10.558626225323291 + s$2 * (-62.375332450326006 + s$2 * (-162.39666946257347 + s$2 * (-184.60509290671104 + s$2 * (-81.2874355063066 + s$2 * -9.814329344169145))))));
			S = 1 + s$2 * (19.651271667439257 + s$2 * (137.65775414351904 + s$2 * (434.56587747522923 + s$2 * (645.3872717332679 + s$2 * (429.00814002756783 + s$2 * (108.63500554177944 + s$2 * (6.570249770319282 + s$2 * -0.0604244152148581)))))));
		} else {
			R = -0.0098649429247001 + s$2 * (-0.799283237680523 + s$2 * (-17.757954917754752 + s$2 * (-160.63638485582192 + s$2 * (-637.5664433683896 + s$2 * (-1025.0951316110772 + s$2 * -483.5191916086514)))));
			S = 1 + s$2 * (30.33806074348246 + s$2 * (325.7925129965739 + s$2 * (1536.729586084437 + s$2 * (3199.8582195085955 + s$2 * (2553.0504064331644 + s$2 * (474.52854120695537 + s$2 * -22.44095244658582))))));
		}
		z$1 = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high & 4294967295, (x$1.low & 0) >>> 0)));
		r$1 = Exp(-z$1 * z$1 - 0.5625) * Exp((z$1 - x) * (z$1 + x) + R / S);
		if (sign) {
			return r$1 / x - 1;
		}
		return 1 - r$1 / x;
	};
	var Erfc = function(x) {
		var sign, temp, z, r, s, y, s$1, P, Q, s$2, R, S, x$1, z$1, r$1;
		if (IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (IsInf(x, -1)) {
			return 2;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x < 0.84375) {
			temp = 0;
			if (x < 1.3877787807814457e-17) {
				temp = x;
			} else {
				z = x * x;
				r = 0.12837916709551256 + z * (-0.3250421072470015 + z * (-0.02848174957559851 + z * (-0.005770270296489442 + z * -2.3763016656650163e-05)));
				s = 1 + z * (0.39791722395915535 + z * (0.0650222499887673 + z * (0.005081306281875766 + z * (0.00013249473800432164 + z * -3.960228278775368e-06))));
				y = r / s;
				if (x < 0.25) {
					temp = x + x * y;
				} else {
					temp = 0.5 + (x * y + (x - 0.5));
				}
			}
			if (sign) {
				return 1 + temp;
			}
			return 1 - temp;
		}
		if (x < 1.25) {
			s$1 = x - 1;
			P = -0.0023621185607526594 + s$1 * (0.41485611868374833 + s$1 * (-0.3722078760357013 + s$1 * (0.31834661990116175 + s$1 * (-0.11089469428239668 + s$1 * (0.035478304325618236 + s$1 * -0.002166375594868791)))));
			Q = 1 + s$1 * (0.10642088040084423 + s$1 * (0.540397917702171 + s$1 * (0.07182865441419627 + s$1 * (0.12617121980876164 + s$1 * (0.01363708391202905 + s$1 * 0.011984499846799107)))));
			if (sign) {
				return 1.8450629115104675 + P / Q;
			}
			return 0.15493708848953247 - P / Q;
		}
		if (x < 28) {
			s$2 = 1 / (x * x);
			R = 0, S = 0;
			if (x < 2.857142857142857) {
				R = -0.009864944034847148 + s$2 * (-0.6938585727071818 + s$2 * (-10.558626225323291 + s$2 * (-62.375332450326006 + s$2 * (-162.39666946257347 + s$2 * (-184.60509290671104 + s$2 * (-81.2874355063066 + s$2 * -9.814329344169145))))));
				S = 1 + s$2 * (19.651271667439257 + s$2 * (137.65775414351904 + s$2 * (434.56587747522923 + s$2 * (645.3872717332679 + s$2 * (429.00814002756783 + s$2 * (108.63500554177944 + s$2 * (6.570249770319282 + s$2 * -0.0604244152148581)))))));
			} else {
				if (sign && x > 6) {
					return 2;
				}
				R = -0.0098649429247001 + s$2 * (-0.799283237680523 + s$2 * (-17.757954917754752 + s$2 * (-160.63638485582192 + s$2 * (-637.5664433683896 + s$2 * (-1025.0951316110772 + s$2 * -483.5191916086514)))));
				S = 1 + s$2 * (30.33806074348246 + s$2 * (325.7925129965739 + s$2 * (1536.729586084437 + s$2 * (3199.8582195085955 + s$2 * (2553.0504064331644 + s$2 * (474.52854120695537 + s$2 * -22.44095244658582))))));
			}
			z$1 = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high & 4294967295, (x$1.low & 0) >>> 0)));
			r$1 = Exp(-z$1 * z$1 - 0.5625) * Exp((z$1 - x) * (z$1 + x) + R / S);
			if (sign) {
				return 2 - r$1 / x;
			}
			return r$1 / x;
		}
		if (sign) {
			return 2;
		}
		return 0;
	};
	var Exp = function(x) {
		throw go$panic("Native function not implemented: Exp");
	};
	var exp = function(x) {
		var k, hi, lo;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (IsInf(x, -1)) {
			return 0;
		} else if (x > 709.782712893384) {
			return Inf(1);
		} else if (x < -745.1332191019411) {
			return 0;
		} else if (-3.725290298461914e-09 < x && x < 3.725290298461914e-09) {
			return 1 + x;
		}
		k = 0;
		if (x < 0) {
			k = ((1.4426950408889634 * x - 0.5 >> 0) >> 0);
		} else if (x > 0) {
			k = ((1.4426950408889634 * x + 0.5 >> 0) >> 0);
		}
		hi = x - k * 0.6931471803691238;
		lo = k * 1.9082149292705877e-10;
		return expmulti(hi, lo, k);
	};
	var Exp2 = function(x) {
		throw go$panic("Native function not implemented: Exp2");
	};
	var exp2 = function(x) {
		var k, t, hi, lo;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (IsInf(x, -1)) {
			return 0;
		} else if (x > 1023.9999999999999) {
			return Inf(1);
		} else if (x < -1074) {
			return 0;
		}
		k = 0;
		if (x > 0) {
			k = ((x + 0.5 >> 0) >> 0);
		} else if (x < 0) {
			k = ((x - 0.5 >> 0) >> 0);
		}
		t = x - k;
		hi = t * 0.6931471803691238;
		lo = -t * 1.9082149292705877e-10;
		return expmulti(hi, lo, k);
	};
	var expmulti = function(hi, lo, k) {
		var r, t, c, y;
		r = hi - lo;
		t = r * r;
		c = r - t * (0.16666666666666602 + t * (-0.0027777777777015593 + t * (6.613756321437934e-05 + t * (-1.6533902205465252e-06 + t * 4.1381367970572385e-08))));
		y = 1 - ((lo - (r * c) / (2 - c)) - hi);
		return Ldexp(y, k);
	};
	var Expm1 = function(x) {
		throw go$panic("Native function not implemented: Expm1");
	};
	var expm1 = function(x) {
		var absx, sign, c, k, hi, lo, t, hfx, hxs, r1, t$1, e, y, x$1, x$2, x$3, t$2, y$1, x$4, x$5, t$3, y$2, x$6, x$7;
		if (IsInf(x, 1) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, -1)) {
			return -1;
		}
		absx = x;
		sign = false;
		if (x < 0) {
			absx = -absx;
			sign = true;
		}
		if (absx >= 38.816242111356935) {
			if (absx >= 709.782712893384) {
				return Inf(1);
			}
			if (sign) {
				return -1;
			}
		}
		c = 0;
		k = 0;
		if (absx > 0.34657359027997264) {
			hi = 0, lo = 0;
			if (absx < 1.0397207708399179) {
				if (!sign) {
					hi = x - 0.6931471803691238;
					lo = 1.9082149292705877e-10;
					k = 1;
				} else {
					hi = x + 0.6931471803691238;
					lo = -1.9082149292705877e-10;
					k = -1;
				}
			} else {
				if (!sign) {
					k = ((1.4426950408889634 * x + 0.5 >> 0) >> 0);
				} else {
					k = ((1.4426950408889634 * x - 0.5 >> 0) >> 0);
				}
				t = k;
				hi = x - t * 0.6931471803691238;
				lo = t * 1.9082149292705877e-10;
			}
			x = hi - lo;
			c = (hi - x) - lo;
		} else if (absx < 5.551115123125783e-17) {
			return x;
		} else {
			k = 0;
		}
		hfx = 0.5 * x;
		hxs = x * hfx;
		r1 = 1 + hxs * (-0.03333333333333313 + hxs * (0.0015873015872548146 + hxs * (-7.93650757867488e-05 + hxs * (4.008217827329362e-06 + hxs * -2.0109921818362437e-07))));
		t$1 = 3 - r1 * hfx;
		e = hxs * ((r1 - t$1) / (6 - x * t$1));
		if (!(k === 0)) {
			e = (x * (e - c) - c);
			e = e - (hxs);
			if (k === -1) {
				return 0.5 * (x - e) - 0.5;
			} else if (k === 1) {
				if (x < -0.25) {
					return -2 * (e - (x + 0.5));
				}
				return 1 + 2 * (x - e);
			} else if (k <= -2 || k > 56) {
				y = 1 - (e - x);
				y = Float64frombits((x$1 = Float64bits(y), x$2 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$1.high + x$2.high, x$1.low + x$2.low)));
				return y - 1;
			}
			if (k < 20) {
				t$2 = Float64frombits((x$3 = (go$shiftRightUint64(new Go$Uint64(2097152, 0), (k >>> 0))), new Go$Uint64(1072693248 - x$3.high, 0 - x$3.low)));
				y$1 = t$2 - (e - x);
				y$1 = Float64frombits((x$4 = Float64bits(y$1), x$5 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$4.high + x$5.high, x$4.low + x$5.low)));
				return y$1;
			}
			t$3 = Float64frombits(new Go$Uint64(0, (((1023 - k >> 0)) << 52 >> 0)));
			y$2 = x - (e + t$3);
			y$2 = y$2 + 1;
			y$2 = Float64frombits((x$6 = Float64bits(y$2), x$7 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$6.high + x$7.high, x$6.low + x$7.low)));
			return y$2;
		}
		return x - (x * e - hxs);
	};
	var Floor = function(x) {
		throw go$panic("Native function not implemented: Floor");
	};
	var floor = function(x) {
		var _tuple, d, fract, _tuple$1, d$1;
		if (x === 0 || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		if (x < 0) {
			_tuple = Modf(-x), d = _tuple[0], fract = _tuple[1];
			if (!(fract === 0)) {
				d = d + 1;
			}
			return -d;
		}
		_tuple$1 = Modf(x), d$1 = _tuple$1[0];
		return d$1;
	};
	var Ceil = function(x) {
		throw go$panic("Native function not implemented: Ceil");
	};
	var ceil = function(x) {
		return -Floor(-x);
	};
	var Trunc = function(x) {
		throw go$panic("Native function not implemented: Trunc");
	};
	var trunc = function(x) {
		var _tuple, d;
		if (x === 0 || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		_tuple = Modf(x), d = _tuple[0];
		return d;
	};
	var Frexp = function(f) {
		throw go$panic("Native function not implemented: Frexp");
	};
	var frexp = function(f) {
		var frac, exp$1, _tuple, _tuple$1, _tuple$2, x, x$1;
		frac = 0;
		exp$1 = 0;
		if (f === 0) {
			_tuple = [f, 0], frac = _tuple[0], exp$1 = _tuple[1];
			return [frac, exp$1];
		} else if (IsInf(f, 0) || IsNaN(f)) {
			_tuple$1 = [f, 0], frac = _tuple$1[0], exp$1 = _tuple$1[1];
			return [frac, exp$1];
		}
		_tuple$2 = normalize(f), f = _tuple$2[0], exp$1 = _tuple$2[1];
		x = Float64bits(f);
		exp$1 = (exp$1 + (((((x$1 = (go$shiftRightUint64(x, 52)), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0) - 1023 >> 0) + 1 >> 0)) >> 0);
		x = new Go$Uint64(x.high &~ 2146435072, (x.low &~ 0) >>> 0);
		x = new Go$Uint64(x.high | 1071644672, (x.low | 0) >>> 0);
		frac = Float64frombits(x);
		return [frac, exp$1];
	};
	var stirling = function(x) {
		var w, y, v;
		w = 1 / x;
		w = 1 + w * ((((_gamS[0] * w + _gamS[1]) * w + _gamS[2]) * w + _gamS[3]) * w + _gamS[4]);
		y = Exp(x);
		if (x > 143.01608) {
			v = Pow(x, 0.5 * x - 0.25);
			y = v * (v / y);
		} else {
			y = Pow(x, x - 0.5) / y;
		}
		y = 2.5066282746310007 * y * w;
		return y;
	};
	var Gamma = function(x) {
		var q, p, signgam, ip, z, z$1;
		if (isNegInt(x) || IsInf(x, -1) || IsNaN(x)) {
			return NaN();
		} else if (x === 0) {
			if (Signbit(x)) {
				return Inf(-1);
			}
			return Inf(1);
		} else if (x < -170.5674972726612 || x > 171.61447887182297) {
			return Inf(1);
		}
		q = Abs(x);
		p = Floor(q);
		if (q > 33) {
			if (x >= 0) {
				return stirling(x);
			}
			signgam = 1;
			if (ip = ((p >> 0) >> 0), (ip & 1) === 0) {
				signgam = -1;
			}
			z = q - p;
			if (z > 0.5) {
				p = p + 1;
				z = q - p;
			}
			z = q * Sin(3.141592653589793 * z);
			if (z === 0) {
				return Inf(signgam);
			}
			z = 3.141592653589793 / (Abs(z) * stirling(q));
			return signgam * z;
		}
		z$1 = 1;
		while (x >= 3) {
			x = x - 1;
			z$1 = z$1 * x;
		}
		while (x < 0) {
			if (x > -1e-09) {
				go$notSupported("goto")
			}
			z$1 = z$1 / x;
			x = x + 1;
		}
		while (x < 2) {
			if (x < 1e-09) {
				go$notSupported("goto")
			}
			z$1 = z$1 / x;
			x = x + 1;
		}
		if (x === 2) {
			return z$1;
		}
		x = x - 2;
		p = (((((x * _gamP[0] + _gamP[1]) * x + _gamP[2]) * x + _gamP[3]) * x + _gamP[4]) * x + _gamP[5]) * x + _gamP[6];
		q = ((((((x * _gamQ[0] + _gamQ[1]) * x + _gamQ[2]) * x + _gamQ[3]) * x + _gamQ[4]) * x + _gamQ[5]) * x + _gamQ[6]) * x + _gamQ[7];
		return z$1 * p / q;
		if (x === 0) {
			return Inf(1);
		}
		return z$1 / ((1 + 0.5772156649015329 * x) * x);
	};
	var isNegInt = function(x) {
		var _tuple, xf;
		if (x < 0) {
			_tuple = Modf(x), xf = _tuple[1];
			return xf === 0;
		}
		return false;
	};
	var Hypot = function(p, q) {
		throw go$panic("Native function not implemented: Hypot");
	};
	var hypot = function(p, q) {
		var _tuple;
		if (IsInf(p, 0) || IsInf(q, 0)) {
			return Inf(1);
		} else if (IsNaN(p) || IsNaN(q)) {
			return NaN();
		}
		if (p < 0) {
			p = -p;
		}
		if (q < 0) {
			q = -q;
		}
		if (p < q) {
			_tuple = [q, p], p = _tuple[0], q = _tuple[1];
		}
		if (p === 0) {
			return 0;
		}
		q = q / p;
		return p * Sqrt(1 + q * q);
	};
	var J0 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, r, s$1, u$1;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return 0;
		} else if (x === 0) {
			return 1;
		}
		if (x < 0) {
			x = -x;
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = s - c;
			cc = s + c;
			if (x < 8.988465674311579e+307) {
				z = -Cos(x + x);
				if (s * c < 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * cc / Sqrt(x);
			} else {
				u = pzero(x);
				v = qzero(x);
				z$1 = 0.5641895835477563 * (u * cc - v * ss) / Sqrt(x);
			}
			return z$1;
		}
		if (x < 0.0001220703125) {
			if (x < 7.450580596923828e-09) {
				return 1;
			}
			return 1 - 0.25 * x * x;
		}
		z$2 = x * x;
		r = z$2 * (0.015624999999999995 + z$2 * (-0.00018997929423885472 + z$2 * (1.8295404953270067e-06 + z$2 * -4.618326885321032e-09)));
		s$1 = 1 + z$2 * (0.015619102946489001 + z$2 * (0.00011692678466333745 + z$2 * (5.135465502073181e-07 + z$2 * 1.1661400333379e-09)));
		if (x < 1) {
			return 1 + z$2 * (-0.25 + (r / s$1));
		}
		u$1 = 0.5 * x;
		return (1 + u$1) * (1 - u$1) + z$2 * (r / s$1);
	};
	var Y0 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, u$1, v$1;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (x === 0) {
			return Inf(-1);
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = s - c;
			cc = s + c;
			if (x < 8.988465674311579e+307) {
				z = -Cos(x + x);
				if (s * c < 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * ss / Sqrt(x);
			} else {
				u = pzero(x);
				v = qzero(x);
				z$1 = 0.5641895835477563 * (u * ss + v * cc) / Sqrt(x);
			}
			return z$1;
		}
		if (x <= 7.450580596923828e-09) {
			return -0.07380429510868723 + 0.6366197723675814 * Log(x);
		}
		z$2 = x * x;
		u$1 = -0.07380429510868723 + z$2 * (0.17666645250918112 + z$2 * (-0.01381856719455969 + z$2 * (0.00034745343209368365 + z$2 * (-3.8140705372436416e-06 + z$2 * (1.9559013703502292e-08 + z$2 * -3.982051941321034e-11)))));
		v$1 = 1 + z$2 * (0.01273048348341237 + z$2 * (7.600686273503533e-05 + z$2 * (2.591508518404578e-07 + z$2 * 4.4111031133267547e-10)));
		return u$1 / v$1 + 0.6366197723675814 * J0(x) * Log(x);
	};
	var pzero = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; });
		q = go$makeNativeArray("Float64", 5, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(p0R8, function(entry) { return entry; });
			q = go$mapArray(p0S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(p0R5, function(entry) { return entry; });
			q = go$mapArray(p0S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(p0R3, function(entry) { return entry; });
			q = go$mapArray(p0S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(p0R2, function(entry) { return entry; });
			q = go$mapArray(p0S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * q[4]))));
		return 1 + r / s;
	};
	var qzero = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; }), q = go$makeNativeArray("Float64", 6, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(q0R8, function(entry) { return entry; });
			q = go$mapArray(q0S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(q0R5, function(entry) { return entry; });
			q = go$mapArray(q0S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(q0R3, function(entry) { return entry; });
			q = go$mapArray(q0S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(q0R2, function(entry) { return entry; });
			q = go$mapArray(q0S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * (q[4] + z * q[5])))));
		return (-0.125 + r / s) / x;
	};
	var J1 = function(x) {
		var sign, _tuple, s, c, ss, cc, z, z$1, u, v, z$2, r, s$1;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0) || x === 0) {
			return 0;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = -s - c;
			cc = s - c;
			if (x < 8.988465674311579e+307) {
				z = Cos(x + x);
				if (s * c > 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * cc / Sqrt(x);
			} else {
				u = pone(x);
				v = qone(x);
				z$1 = 0.5641895835477563 * (u * cc - v * ss) / Sqrt(x);
			}
			if (sign) {
				return -z$1;
			}
			return z$1;
		}
		if (x < 7.450580596923828e-09) {
			return 0.5 * x;
		}
		z$2 = x * x;
		r = z$2 * (-0.0625 + z$2 * (0.001407056669551897 + z$2 * (-1.599556310840356e-05 + z$2 * 4.9672799960958445e-08)));
		s$1 = 1 + z$2 * (0.019153759953836346 + z$2 * (0.00018594678558863092 + z$2 * (1.1771846404262368e-06 + z$2 * (5.0463625707621704e-09 + z$2 * 1.2354227442613791e-11))));
		r = r * (x);
		z$2 = 0.5 * x + r / s$1;
		if (sign) {
			return -z$2;
		}
		return z$2;
	};
	var Y1 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, u$1, v$1;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (x === 0) {
			return Inf(-1);
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = -s - c;
			cc = s - c;
			if (x < 8.988465674311579e+307) {
				z = Cos(x + x);
				if (s * c > 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * ss / Sqrt(x);
			} else {
				u = pone(x);
				v = qone(x);
				z$1 = 0.5641895835477563 * (u * ss + v * cc) / Sqrt(x);
			}
			return z$1;
		}
		if (x <= 5.551115123125783e-17) {
			return -0.6366197723675814 / x;
		}
		z$2 = x * x;
		u$1 = -0.19605709064623894 + z$2 * (0.05044387166398113 + z$2 * (-0.0019125689587576355 + z$2 * (2.352526005616105e-05 + z$2 * -9.190991580398789e-08)));
		v$1 = 1 + z$2 * (0.01991673182366499 + z$2 * (0.00020255258102513517 + z$2 * (1.3560880109751623e-06 + z$2 * (6.227414523646215e-09 + z$2 * 1.6655924620799208e-11))));
		return x * (u$1 / v$1) + 0.6366197723675814 * (J1(x) * Log(x) - 1 / x);
	};
	var pone = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; });
		q = go$makeNativeArray("Float64", 5, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(p1R8, function(entry) { return entry; });
			q = go$mapArray(p1S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(p1R5, function(entry) { return entry; });
			q = go$mapArray(p1S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(p1R3, function(entry) { return entry; });
			q = go$mapArray(p1S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(p1R2, function(entry) { return entry; });
			q = go$mapArray(p1S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * q[4]))));
		return 1 + r / s;
	};
	var qone = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; }), q = go$makeNativeArray("Float64", 6, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(q1R8, function(entry) { return entry; });
			q = go$mapArray(q1S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(q1R5, function(entry) { return entry; });
			q = go$mapArray(q1S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(q1R3, function(entry) { return entry; });
			q = go$mapArray(q1S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(q1R2, function(entry) { return entry; });
			q = go$mapArray(q1S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * (q[4] + z * q[5])))));
		return (0.375 + r / s) / x;
	};
	var Jn = function(n, x) {
		var _tuple, sign, b, temp, _ref, _tuple$1, i, a, _tuple$2, temp$1, a$1, i$1, w, h, q0, z, q1, k, _tuple$3, m, t, x$1, x$2, i$2, a$2, tmp, v, i$3, di, _tuple$4, i$4, di$1, _tuple$5;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return 0;
		}
		if (n === 0) {
			return J0(x);
		}
		if (x === 0) {
			return 0;
		}
		if (n < 0) {
			_tuple = [-n, -x], n = _tuple[0], x = _tuple[1];
		}
		if (n === 1) {
			return J1(x);
		}
		sign = false;
		if (x < 0) {
			x = -x;
			if ((n & 1) === 1) {
				sign = true;
			}
		}
		b = 0;
		if (n <= x) {
			if (x >= 8.148143905337944e+90) {
				temp = 0;
				_ref = (n & 3);
				if (_ref === 0) {
					temp = Cos(x) + Sin(x);
				} else if (_ref === 1) {
					temp = -Cos(x) + Sin(x);
				} else if (_ref === 2) {
					temp = -Cos(x) - Sin(x);
				} else if (_ref === 3) {
					temp = Cos(x) - Sin(x);
				}
				b = 0.5641895835477563 * temp / Sqrt(x);
			} else {
				b = J1(x);
				_tuple$1 = [1, J0(x)], i = _tuple$1[0], a = _tuple$1[1];
				while (i < n) {
					_tuple$2 = [b, b * ((i + i >> 0) / x) - a], a = _tuple$2[0], b = _tuple$2[1];
					i = (i + 1 >> 0);
				}
			}
		} else {
			if (x < 1.862645149230957e-09) {
				if (n > 33) {
					b = 0;
				} else {
					temp$1 = x * 0.5;
					b = temp$1;
					a$1 = 1;
					i$1 = 2;
					while (i$1 <= n) {
						a$1 = a$1 * (i$1);
						b = b * (temp$1);
						i$1 = (i$1 + 1 >> 0);
					}
					b = b / (a$1);
				}
			} else {
				w = (n + n >> 0) / x;
				h = 2 / x;
				q0 = w;
				z = w + h;
				q1 = w * z - 1;
				k = 1;
				while (q1 < 1e+09) {
					k = (k + 1 >> 0);
					z = z + (h);
					_tuple$3 = [q1, z * q1 - q0], q0 = _tuple$3[0], q1 = _tuple$3[1];
				}
				m = (n + n >> 0);
				t = 0;
				i$2 = (x$1 = 2, x$2 = ((n + k >> 0)), ((((x$1 >>> 16 << 16) * x$2 >> 0) + (x$1 << 16 >>> 16) * x$2) >> 0));
				while (i$2 >= m) {
					t = 1 / (i$2 / x - t);
					i$2 = (i$2 - 2 >> 0);
				}
				a$2 = t;
				b = 1;
				tmp = n;
				v = 2 / x;
				tmp = tmp * Log(Abs(v * tmp));
				if (tmp < 709.782712893384) {
					i$3 = (n - 1 >> 0);
					while (i$3 > 0) {
						di = (i$3 + i$3 >> 0);
						_tuple$4 = [b, b * di / x - a$2], a$2 = _tuple$4[0], b = _tuple$4[1];
						di = di - 2;
						i$3 = (i$3 - 1 >> 0);
					}
				} else {
					i$4 = (n - 1 >> 0);
					while (i$4 > 0) {
						di$1 = (i$4 + i$4 >> 0);
						_tuple$5 = [b, b * di$1 / x - a$2], a$2 = _tuple$5[0], b = _tuple$5[1];
						di$1 = di$1 - 2;
						if (b > 1e+100) {
							a$2 = a$2 / (b);
							t = t / (b);
							b = 1;
						}
						i$4 = (i$4 - 1 >> 0);
					}
				}
				b = t * J0(x) / b;
			}
		}
		if (sign) {
			return -b;
		}
		return b;
	};
	var Yn = function(n, x) {
		var sign, b, temp, _ref, a, i, _tuple;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		}
		if (n === 0) {
			return Y0(x);
		}
		if (x === 0) {
			if (n < 0 && (n & 1) === 1) {
				return Inf(1);
			}
			return Inf(-1);
		}
		sign = false;
		if (n < 0) {
			n = -n;
			if ((n & 1) === 1) {
				sign = true;
			}
		}
		if (n === 1) {
			if (sign) {
				return -Y1(x);
			}
			return Y1(x);
		}
		b = 0;
		if (x >= 8.148143905337944e+90) {
			temp = 0;
			_ref = (n & 3);
			if (_ref === 0) {
				temp = Sin(x) - Cos(x);
			} else if (_ref === 1) {
				temp = -Sin(x) - Cos(x);
			} else if (_ref === 2) {
				temp = -Sin(x) + Cos(x);
			} else if (_ref === 3) {
				temp = Sin(x) + Cos(x);
			}
			b = 0.5641895835477563 * temp / Sqrt(x);
		} else {
			a = Y0(x);
			b = Y1(x);
			i = 1;
			while (i < n && !IsInf(b, -1)) {
				_tuple = [b, ((i + i >> 0) / x) * b - a], a = _tuple[0], b = _tuple[1];
				i = (i + 1 >> 0);
			}
		}
		if (sign) {
			return -b;
		}
		return b;
	};
	var Ldexp = function(frac, exp$1) {
		throw go$panic("Native function not implemented: Ldexp");
	};
	var ldexp = function(frac, exp$1) {
		var _tuple, e, x, m, x$1;
		if (frac === 0) {
			return frac;
		} else if (IsInf(frac, 0) || IsNaN(frac)) {
			return frac;
		}
		_tuple = normalize(frac), frac = _tuple[0], e = _tuple[1];
		exp$1 = (exp$1 + (e) >> 0);
		x = Float64bits(frac);
		exp$1 = (exp$1 + ((((go$shiftRightUint64(x, 52).low >> 0) & 2047) - 1023 >> 0)) >> 0);
		if (exp$1 < -1074) {
			return Copysign(0, frac);
		}
		if (exp$1 > 1023) {
			if (frac < 0) {
				return Inf(-1);
			}
			return Inf(1);
		}
		m = 1;
		if (exp$1 < -1022) {
			exp$1 = (exp$1 + 52 >> 0);
			m = 2.220446049250313e-16;
		}
		x = new Go$Uint64(x.high &~ 2146435072, (x.low &~ 0) >>> 0);
		x = (x$1 = (go$shiftLeft64(new Go$Uint64(0, (exp$1 + 1023 >> 0)), 52)), new Go$Uint64(x.high | x$1.high, (x.low | x$1.low) >>> 0));
		return m * Float64frombits(x);
	};
	var Lgamma = function(x) {
		var lgamma, sign, neg, nadj, t, y, i, _ref, z, p1, p2, p, z$1, w, p1$1, p2$1, p3, p$1, p1$2, p2$2, i$1, y$1, p$2, q, z$2, _ref$1, t$1, z$3, y$2, w$1;
		lgamma = 0;
		sign = 0;
		sign = 1;
		if (IsNaN(x)) {
			lgamma = x;
			return [lgamma, sign];
		} else if (IsInf(x, 0)) {
			lgamma = x;
			return [lgamma, sign];
		} else if (x === 0) {
			lgamma = Inf(1);
			return [lgamma, sign];
		}
		neg = false;
		if (x < 0) {
			x = -x;
			neg = true;
		}
		if (x < 8.470329472543003e-22) {
			if (neg) {
				sign = -1;
			}
			lgamma = -Log(x);
			return [lgamma, sign];
		}
		nadj = 0;
		if (neg) {
			if (x >= 4.503599627370496e+15) {
				lgamma = Inf(1);
				return [lgamma, sign];
			}
			t = sinPi(x);
			if (t === 0) {
				lgamma = Inf(1);
				return [lgamma, sign];
			}
			nadj = Log(3.141592653589793 / Abs(t * x));
			if (t < 0) {
				sign = -1;
			}
		}
		if (x === 1 || x === 2) {
			lgamma = 0;
			return [lgamma, sign];
		} else if (x < 2) {
			y = 0;
			i = 0;
			if (x <= 0.9) {
				lgamma = -Log(x);
				if (x >= 0.7316321449683623) {
					y = 1 - x;
					i = 0;
				} else if (x >= 0.19163214496836226) {
					y = x - 0.46163214496836225;
					i = 1;
				} else {
					y = x;
					i = 2;
				}
			} else {
				lgamma = 0;
				if (x >= 1.7316321449683623) {
					y = 2 - x;
					i = 0;
				} else if (x >= 1.1916321449683622) {
					y = x - 1.4616321449683622;
					i = 1;
				} else {
					y = x - 1;
					i = 2;
				}
			}
			_ref = i;
			if (_ref === 0) {
				z = y * y;
				p1 = _lgamA[0] + z * (_lgamA[2] + z * (_lgamA[4] + z * (_lgamA[6] + z * (_lgamA[8] + z * _lgamA[10]))));
				p2 = z * (_lgamA[1] + z * (_lgamA[3] + z * (_lgamA[5] + z * (_lgamA[7] + z * (_lgamA[9] + z * _lgamA[11])))));
				p = y * p1 + p2;
				lgamma = lgamma + ((p - 0.5 * y));
			} else if (_ref === 1) {
				z$1 = y * y;
				w = z$1 * y;
				p1$1 = _lgamT[0] + w * (_lgamT[3] + w * (_lgamT[6] + w * (_lgamT[9] + w * _lgamT[12])));
				p2$1 = _lgamT[1] + w * (_lgamT[4] + w * (_lgamT[7] + w * (_lgamT[10] + w * _lgamT[13])));
				p3 = _lgamT[2] + w * (_lgamT[5] + w * (_lgamT[8] + w * (_lgamT[11] + w * _lgamT[14])));
				p$1 = z$1 * p1$1 - (-3.638676997039505e-18 - w * (p2$1 + y * p3));
				lgamma = lgamma + ((-0.12148629053584961 + p$1));
			} else if (_ref === 2) {
				p1$2 = y * (_lgamU[0] + y * (_lgamU[1] + y * (_lgamU[2] + y * (_lgamU[3] + y * (_lgamU[4] + y * _lgamU[5])))));
				p2$2 = 1 + y * (_lgamV[1] + y * (_lgamV[2] + y * (_lgamV[3] + y * (_lgamV[4] + y * _lgamV[5]))));
				lgamma = lgamma + ((-0.5 * y + p1$2 / p2$2));
			}
		} else if (x < 8) {
			i$1 = ((x >> 0) >> 0);
			y$1 = x - i$1;
			p$2 = y$1 * (_lgamS[0] + y$1 * (_lgamS[1] + y$1 * (_lgamS[2] + y$1 * (_lgamS[3] + y$1 * (_lgamS[4] + y$1 * (_lgamS[5] + y$1 * _lgamS[6]))))));
			q = 1 + y$1 * (_lgamR[1] + y$1 * (_lgamR[2] + y$1 * (_lgamR[3] + y$1 * (_lgamR[4] + y$1 * (_lgamR[5] + y$1 * _lgamR[6])))));
			lgamma = 0.5 * y$1 + p$2 / q;
			z$2 = 1;
			_ref$1 = i$1;
			if (_ref$1 === 7) {
				z$2 = z$2 * ((y$1 + 6));
				z$2 = z$2 * ((y$1 + 5));
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 6) {
				z$2 = z$2 * ((y$1 + 5));
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 5) {
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 4) {
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 3) {
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			}
		} else if (x < 2.8823037615171174e+17) {
			t$1 = Log(x);
			z$3 = 1 / x;
			y$2 = z$3 * z$3;
			w$1 = _lgamW[0] + z$3 * (_lgamW[1] + y$2 * (_lgamW[2] + y$2 * (_lgamW[3] + y$2 * (_lgamW[4] + y$2 * (_lgamW[5] + y$2 * _lgamW[6])))));
			lgamma = (x - 0.5) * (t$1 - 1) + w$1;
		} else {
			lgamma = x * (Log(x) - 1);
		}
		if (neg) {
			lgamma = nadj - lgamma;
		}
		return [lgamma, sign];
	};
	var sinPi = function(x) {
		var z, n, x$1, _ref;
		if (x < 0.25) {
			return -Sin(3.141592653589793 * x);
		}
		z = Floor(x);
		n = 0;
		if (!(z === x)) {
			x = Mod(x, 2);
			n = ((x * 4 >> 0) >> 0);
		} else {
			if (x >= 9.007199254740992e+15) {
				x = 0;
				n = 0;
			} else {
				if (x < 4.503599627370496e+15) {
					z = x + 4.503599627370496e+15;
				}
				n = ((x$1 = Float64bits(z), new Go$Uint64(0 & x$1.high, (1 & x$1.low) >>> 0)).low >> 0);
				x = n;
				n = (n << 2 >> 0);
			}
		}
		_ref = n;
		if (_ref === 0) {
			x = Sin(3.141592653589793 * x);
		} else if (_ref === 1 || _ref === 2) {
			x = Cos(3.141592653589793 * (0.5 - x));
		} else if (_ref === 3 || _ref === 4) {
			x = Sin(3.141592653589793 * (1 - x));
		} else if (_ref === 5 || _ref === 6) {
			x = -Cos(3.141592653589793 * (x - 1.5));
		} else {
			x = Sin(3.141592653589793 * (x - 2));
		}
		return -x;
	};
	var Log = function(x) {
		throw go$panic("Native function not implemented: Log");
	};
	var log = function(x) {
		var _tuple, f1, ki, f, k, s, s2, s4, t1, t2, R, hfsq;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (x < 0) {
			return NaN();
		} else if (x === 0) {
			return Inf(-1);
		}
		_tuple = Frexp(x), f1 = _tuple[0], ki = _tuple[1];
		if (f1 < 0.7071067811865476) {
			f1 = f1 * 2;
			ki = (ki - 1 >> 0);
		}
		f = f1 - 1;
		k = ki;
		s = f / (2 + f);
		s2 = s * s;
		s4 = s2 * s2;
		t1 = s2 * (0.6666666666666735 + s4 * (0.2857142874366239 + s4 * (0.1818357216161805 + s4 * 0.14798198605116586)));
		t2 = s4 * (0.3999999999940942 + s4 * (0.22222198432149784 + s4 * 0.15313837699209373));
		R = t1 + t2;
		hfsq = 0.5 * f * f;
		return k * 0.6931471803691238 - ((hfsq - (s * (hfsq + R) + k * 1.9082149292705877e-10)) - f);
	};
	var Log10 = function(x) {
		throw go$panic("Native function not implemented: Log10");
	};
	var log10 = function(x) {
		return Log(x) * 0.4342944819032518;
	};
	var Log2 = function(x) {
		throw go$panic("Native function not implemented: Log2");
	};
	var log2 = function(x) {
		var _tuple, frac, exp$1;
		_tuple = Frexp(x), frac = _tuple[0], exp$1 = _tuple[1];
		return Log(frac) * 1.4426950408889634 + exp$1;
	};
	var Log1p = function(x) {
		throw go$panic("Native function not implemented: Log1p");
	};
	var log1p = function(x) {
		var absx, f, iu, k, c, u, x$1, x$2, hfsq, s, R, z;
		if (x < -1 || IsNaN(x)) {
			return NaN();
		} else if (x === -1) {
			return Inf(-1);
		} else if (IsInf(x, 1)) {
			return Inf(1);
		}
		absx = x;
		if (absx < 0) {
			absx = -absx;
		}
		f = 0;
		iu = new Go$Uint64(0, 0);
		k = 1;
		if (absx < 0.41421356237309503) {
			if (absx < 1.862645149230957e-09) {
				if (absx < 5.551115123125783e-17) {
					return x;
				}
				return x - x * x * 0.5;
			}
			if (x > -0.2928932188134525) {
				k = 0;
				f = x;
				iu = new Go$Uint64(0, 1);
			}
		}
		c = 0;
		if (!(k === 0)) {
			u = 0;
			if (absx < 9.007199254740992e+15) {
				u = 1 + x;
				iu = Float64bits(u);
				k = ((x$1 = (go$shiftRightUint64(iu, 52)), new Go$Uint64(x$1.high - 0, x$1.low - 1023)).low >> 0);
				if (k > 0) {
					c = 1 - (u - x);
				} else {
					c = x - (u - 1);
					c = c / (u);
				}
			} else {
				u = x;
				iu = Float64bits(u);
				k = ((x$2 = (go$shiftRightUint64(iu, 52)), new Go$Uint64(x$2.high - 0, x$2.low - 1023)).low >> 0);
				c = 0;
			}
			iu = new Go$Uint64(iu.high & 1048575, (iu.low & 4294967295) >>> 0);
			if ((iu.high < 434334 || (iu.high === 434334 && iu.low < 1719614413))) {
				u = Float64frombits(new Go$Uint64(iu.high | 1072693248, (iu.low | 0) >>> 0));
			} else {
				k = (k + 1 >> 0);
				u = Float64frombits(new Go$Uint64(iu.high | 1071644672, (iu.low | 0) >>> 0));
				iu = go$shiftRightUint64((new Go$Uint64(1048576 - iu.high, 0 - iu.low)), 2);
			}
			f = u - 1;
		}
		hfsq = 0.5 * f * f;
		s = 0, R = 0, z = 0;
		if ((iu.high === 0 && iu.low === 0)) {
			if (f === 0) {
				if (k === 0) {
					return 0;
				} else {
					c = c + (k * 1.9082149292705877e-10);
					return k * 0.6931471803691238 + c;
				}
			}
			R = hfsq * (1 - 0.6666666666666666 * f);
			if (k === 0) {
				return f - R;
			}
			return k * 0.6931471803691238 - ((R - (k * 1.9082149292705877e-10 + c)) - f);
		}
		s = f / (2 + f);
		z = s * s;
		R = z * (0.6666666666666735 + z * (0.3999999999940942 + z * (0.2857142874366239 + z * (0.22222198432149784 + z * (0.1818357216161805 + z * (0.15313837699209373 + z * 0.14798198605116586))))));
		if (k === 0) {
			return f - (hfsq - s * (hfsq + R));
		}
		return k * 0.6931471803691238 - ((hfsq - (s * (hfsq + R) + (k * 1.9082149292705877e-10 + c))) - f);
	};
	var Logb = function(x) {
		if (x === 0) {
			return Inf(-1);
		} else if (IsInf(x, 0)) {
			return Inf(1);
		} else if (IsNaN(x)) {
			return x;
		}
		return ilogb(x);
	};
	var Ilogb = function(x) {
		if (x === 0) {
			return -2147483648;
		} else if (IsNaN(x)) {
			return 2147483647;
		} else if (IsInf(x, 0)) {
			return 2147483647;
		}
		return ilogb(x);
	};
	var ilogb = function(x) {
		var _tuple, exp$1, x$1;
		_tuple = normalize(x), x = _tuple[0], exp$1 = _tuple[1];
		return ((((x$1 = (go$shiftRightUint64(Float64bits(x), 52)), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0) - 1023 >> 0) + exp$1 >> 0);
	};
	var Mod = function(x, y) {
		throw go$panic("Native function not implemented: Mod");
	};
	var mod = function(x, y) {
		var _tuple, yfr, yexp, sign, r, _tuple$1, rfr, rexp;
		if (y === 0 || IsInf(x, 0) || IsNaN(x) || IsNaN(y)) {
			return NaN();
		}
		if (y < 0) {
			y = -y;
		}
		_tuple = Frexp(y), yfr = _tuple[0], yexp = _tuple[1];
		sign = false;
		r = x;
		if (x < 0) {
			r = -x;
			sign = true;
		}
		while (r >= y) {
			_tuple$1 = Frexp(r), rfr = _tuple$1[0], rexp = _tuple$1[1];
			if (rfr < yfr) {
				rexp = (rexp - 1 >> 0);
			}
			r = r - Ldexp(y, (rexp - yexp >> 0));
		}
		if (sign) {
			r = -r;
		}
		return r;
	};
	var Modf = function(f) {
		throw go$panic("Native function not implemented: Modf");
	};
	var modf = function(f) {
		var int$1, frac, _tuple, _tuple$1, _tuple$2, x, e, x$1, x$2;
		int$1 = 0;
		frac = 0;
		if (f < 1) {
			if (f < 0) {
				_tuple = Modf(-f), int$1 = _tuple[0], frac = _tuple[1];
				_tuple$1 = [-int$1, -frac], int$1 = _tuple$1[0], frac = _tuple$1[1];
				return [int$1, frac];
			}
			_tuple$2 = [0, f], int$1 = _tuple$2[0], frac = _tuple$2[1];
			return [int$1, frac];
		}
		x = Float64bits(f);
		e = ((((go$shiftRightUint64(x, 52).low >>> 0) & 2047) >>> 0) - 1023 >>> 0);
		if (e < 52) {
			x = (x$1 = ((x$2 = go$shiftLeft64(new Go$Uint64(0, 1), ((52 - e >>> 0))), new Go$Uint64(x$2.high - 0, x$2.low - 1))), new Go$Uint64(x.high &~ x$1.high, (x.low &~ x$1.low) >>> 0));
		}
		int$1 = Float64frombits(x);
		frac = f - int$1;
		return [int$1, frac];
	};
	var Nextafter = function(x, y) {
		var r, x$1, x$2;
		r = 0;
		if (IsNaN(x) || IsNaN(y)) {
			r = NaN();
		} else if (x === y) {
			r = x;
		} else if (x === 0) {
			r = Copysign(Float64frombits(new Go$Uint64(0, 1)), y);
		} else if ((y > x) === (x > 0)) {
			r = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high + 0, x$1.low + 1)));
		} else {
			r = Float64frombits((x$2 = Float64bits(x), new Go$Uint64(x$2.high - 0, x$2.low - 1)));
		}
		return r;
	};
	var isOddInt = function(x) {
		var _tuple, xi, xf, x$1, x$2;
		_tuple = Modf(x), xi = _tuple[0], xf = _tuple[1];
		return xf === 0 && (x$1 = (x$2 = new Go$Int64(0, xi), new Go$Int64(x$2.high & 0, (x$2.low & 1) >>> 0)), (x$1.high === 0 && x$1.low === 1));
	};
	var Pow = function(x, y) {
		var absy, flip, _tuple, yi, yf, a1, ae, _tuple$1, x1, xe, i, x$1;
		if (y === 0 || x === 1) {
			return 1;
		} else if (y === 1) {
			return x;
		} else if (y === 0.5) {
			return Sqrt(x);
		} else if (y === -0.5) {
			return 1 / Sqrt(x);
		} else if (IsNaN(x) || IsNaN(y)) {
			return NaN();
		} else if (x === 0) {
			if (y < 0) {
				if (isOddInt(y)) {
					return Copysign(Inf(1), x);
				}
				return Inf(1);
			} else if (y > 0) {
				if (isOddInt(y)) {
					return x;
				}
				return 0;
			}
		} else if (IsInf(y, 0)) {
			if (x === -1) {
				return 1;
			} else if ((Abs(x) < 1) === IsInf(y, 1)) {
				return 0;
			} else {
				return Inf(1);
			}
		} else if (IsInf(x, 0)) {
			if (IsInf(x, -1)) {
				return Pow(1 / x, -y);
			}
			if (y < 0) {
				return 0;
			} else if (y > 0) {
				return Inf(1);
			}
		}
		absy = y;
		flip = false;
		if (absy < 0) {
			absy = -absy;
			flip = true;
		}
		_tuple = Modf(absy), yi = _tuple[0], yf = _tuple[1];
		if (!(yf === 0) && x < 0) {
			return NaN();
		}
		if (yi >= 9.223372036854776e+18) {
			return Exp(y * Log(x));
		}
		a1 = 1;
		ae = 0;
		if (!(yf === 0)) {
			if (yf > 0.5) {
				yf = yf - 1;
				yi = yi + 1;
			}
			a1 = Exp(yf * Log(x));
		}
		_tuple$1 = Frexp(x), x1 = _tuple$1[0], xe = _tuple$1[1];
		i = new Go$Int64(0, yi);
		while (!((i.high === 0 && i.low === 0))) {
			if ((x$1 = new Go$Int64(i.high & 0, (i.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
				a1 = a1 * (x1);
				ae = (ae + (xe) >> 0);
			}
			x1 = x1 * (x1);
			xe = (xe << 1 >> 0);
			if (x1 < 0.5) {
				x1 = x1 + (x1);
				xe = (xe - 1 >> 0);
			}
			i = go$shiftRightInt64(i, 1);
		}
		if (flip) {
			a1 = 1 / a1;
			ae = -ae;
		}
		return Ldexp(a1, ae);
	};
	var Pow10 = function(e) {
		var _q, m;
		if (e <= -325) {
			return 0;
		} else if (e > 309) {
			return Inf(1);
		}
		if (e < 0) {
			return 1 / Pow10(-e);
		}
		if (e < 70) {
			return pow10tab[e];
		}
		m = (_q = e / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		return Pow10(m) * Pow10((e - m >> 0));
	};
	var Remainder = function(x, y) {
		throw go$panic("Native function not implemented: Remainder");
	};
	var remainder = function(x, y) {
		var sign, yHalf;
		if (IsNaN(x) || IsNaN(y) || IsInf(x, 0) || y === 0) {
			return NaN();
		} else if (IsInf(y, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (y < 0) {
			y = -y;
		}
		if (x === y) {
			return 0;
		}
		if (y <= 8.988465674311579e+307) {
			x = Mod(x, y + y);
		}
		if (y < 4.450147717014403e-308) {
			if (x + x > y) {
				x = x - (y);
				if (x + x >= y) {
					x = x - (y);
				}
			}
		} else {
			yHalf = 0.5 * y;
			if (x > yHalf) {
				x = x - (y);
				if (x >= yHalf) {
					x = x - (y);
				}
			}
		}
		if (sign) {
			x = -x;
		}
		return x;
	};
	var Signbit = function(x) {
		var x$1, x$2;
		return !((x$1 = (x$2 = Float64bits(x), new Go$Uint64(x$2.high & 2147483648, (x$2.low & 0) >>> 0)), (x$1.high === 0 && x$1.low === 0)));
	};
	var Cos = function(x) {
		throw go$panic("Native function not implemented: Cos");
	};
	var cos = function(x) {
		var sign, j, y, x$1, z, zz;
		if (IsNaN(x) || IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			j = new Go$Int64(j.high - 0, j.low - 4);
			sign = !sign;
		}
		if ((j.high > 0 || (j.high === 0 && j.low > 1))) {
			sign = !sign;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			y = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		} else {
			y = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Sin = function(x) {
		throw go$panic("Native function not implemented: Sin");
	};
	var sin = function(x) {
		var sign, j, y, x$1, z, zz;
		if (x === 0 || IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			sign = !sign;
			j = new Go$Int64(j.high - 0, j.low - 4);
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			y = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		} else {
			y = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Sincos = function(x) {
		throw go$panic("Native function not implemented: Sincos");
	};
	var sincos = function(x) {
		var sin$1, cos$1, _tuple, _tuple$1, _tuple$2, sinSign, cosSign, j, y, x$1, _tuple$3, z, zz, _tuple$4;
		sin$1 = 0;
		cos$1 = 0;
		if (x === 0) {
			_tuple = [x, 1], sin$1 = _tuple[0], cos$1 = _tuple[1];
			return [sin$1, cos$1];
		} else if (IsNaN(x) || IsInf(x, 0)) {
			_tuple$1 = [NaN(), NaN()], sin$1 = _tuple$1[0], cos$1 = _tuple$1[1];
			return [sin$1, cos$1];
		}
		_tuple$2 = [false, false], sinSign = _tuple$2[0], cosSign = _tuple$2[1];
		if (x < 0) {
			x = -x;
			sinSign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			j = new Go$Int64(j.high - 0, j.low - 4);
			_tuple$3 = [!sinSign, !cosSign], sinSign = _tuple$3[0], cosSign = _tuple$3[1];
		}
		if ((j.high > 0 || (j.high === 0 && j.low > 1))) {
			cosSign = !cosSign;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		cos$1 = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		sin$1 = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			_tuple$4 = [cos$1, sin$1], sin$1 = _tuple$4[0], cos$1 = _tuple$4[1];
		}
		if (cosSign) {
			cos$1 = -cos$1;
		}
		if (sinSign) {
			sin$1 = -sin$1;
		}
		return [sin$1, cos$1];
	};
	var Sinh = function(x) {
		var sign, temp, _ref, sq;
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		_ref = true;
		if (_ref === x > 21) {
			temp = Exp(x) / 2;
		} else if (_ref === x > 0.5) {
			temp = (Exp(x) - Exp(-x)) / 2;
		} else {
			sq = x * x;
			temp = (((-26.30563213397497 * sq + -2894.211355989564) * sq + -89912.72022039509) * sq + -630767.3640497717) * x;
			temp = temp / (((sq + -173.6789535582337) * sq + 15215.17378790019) * sq + -630767.3640497717);
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Cosh = function(x) {
		if (x < 0) {
			x = -x;
		}
		if (x > 21) {
			return Exp(x) / 2;
		}
		return (Exp(x) + Exp(-x)) / 2;
	};
	var Sqrt = function(x) {
		throw go$panic("Native function not implemented: Sqrt");
	};
	var sqrt = function(x) {
		var ix, x$1, exp$1, x$2, q, s, r, t, x$3, x$4, x$5, x$6, x$7;
		if (x === 0 || IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (x < 0) {
			return NaN();
		}
		ix = Float64bits(x);
		exp$1 = ((x$1 = (go$shiftRightUint64(ix, 52)), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0);
		if (exp$1 === 0) {
			while ((x$2 = go$shiftLeft64(new Go$Uint64(ix.high & 0, (ix.low & 1) >>> 0), 52), (x$2.high === 0 && x$2.low === 0))) {
				ix = go$shiftLeft64(ix, 1);
				exp$1 = (exp$1 - 1 >> 0);
			}
			exp$1 = (exp$1 + 1 >> 0);
		}
		exp$1 = (exp$1 - 1023 >> 0);
		ix = new Go$Uint64(ix.high &~ 2146435072, (ix.low &~ 0) >>> 0);
		ix = new Go$Uint64(ix.high | 1048576, (ix.low | 0) >>> 0);
		if ((exp$1 & 1) === 1) {
			ix = go$shiftLeft64(ix, 1);
		}
		exp$1 = (exp$1 >> 1 >> 0);
		ix = go$shiftLeft64(ix, 1);
		q = new Go$Uint64(0, 0), s = new Go$Uint64(0, 0);
		r = new Go$Uint64(2097152, 0);
		while (!((r.high === 0 && r.low === 0))) {
			t = new Go$Uint64(s.high + r.high, s.low + r.low);
			if ((t.high < ix.high || (t.high === ix.high && t.low <= ix.low))) {
				s = new Go$Uint64(t.high + r.high, t.low + r.low);
				ix = (x$3 = (t), new Go$Uint64(ix.high - x$3.high, ix.low - x$3.low));
				q = (x$4 = (r), new Go$Uint64(q.high + x$4.high, q.low + x$4.low));
			}
			ix = go$shiftLeft64(ix, 1);
			r = go$shiftRightUint64(r, 1);
		}
		if (!((ix.high === 0 && ix.low === 0))) {
			q = (x$5 = (new Go$Uint64(q.high & 0, (q.low & 1) >>> 0)), new Go$Uint64(q.high + x$5.high, q.low + x$5.low));
		}
		ix = (x$6 = go$shiftRightUint64(q, 1), x$7 = go$shiftLeft64(new Go$Uint64(0, ((exp$1 - 1 >> 0) + 1023 >> 0)), 52), new Go$Uint64(x$6.high + x$7.high, x$6.low + x$7.low));
		return Float64frombits(ix);
	};
	var sqrtC = function(f, r) {
		r.go$set(sqrt(f));
	};
	var Tan = function(x) {
		throw go$panic("Native function not implemented: Tan");
	};
	var tan = function(x) {
		var sign, j, y, x$1, z, zz, x$2;
		if (x === 0 || IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if (zz > 1e-14) {
			y = z + z * (zz * (((_tanP[0] * zz) + _tanP[1]) * zz + _tanP[2]) / ((((zz + _tanQ[1]) * zz + _tanQ[2]) * zz + _tanQ[3]) * zz + _tanQ[4]));
		} else {
			y = z;
		}
		if ((x$2 = new Go$Int64(j.high & 0, (j.low & 2) >>> 0), (x$2.high === 0 && x$2.low === 2))) {
			y = -1 / y;
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Tanh = function(x) {
		var z, s, s$1;
		z = Abs(x);
		if (z > 44.014845965556525) {
			if (x < 0) {
				return -1;
			}
			return 1;
		} else if (z >= 0.625) {
			s = Exp(2 * z);
			z = 1 - 2 / (s + 1);
			if (x < 0) {
				z = -z;
			}
		} else {
			if (x === 0) {
				return x;
			}
			s$1 = x * x;
			z = x + x * s$1 * ((tanhP[0] * s$1 + tanhP[1]) * s$1 + tanhP[2]) / (((s$1 + tanhQ[0]) * s$1 + tanhQ[1]) * s$1 + tanhQ[2]);
		}
		return z;
	};
	var Float32bits = function(f) {
		return f;
	};
	var Float32frombits = function(b) {
		return b;
	};
	var Float64bits = function(f) {
		return f;
	};
	var Float64frombits = function(b) {
		return b;
	};
	var uvnan = 9221120237041090561;
	var uvinf = 9218868437227405312;
	var uvneginf = -4503599627370496;
	var mask = 2047;
	var shift = 52;
	var bias = 1023;
	go$pkg.E = 2.718281828459045;
	go$pkg.Pi = 3.141592653589793;
	go$pkg.Phi = 1.618033988749895;
	go$pkg.Sqrt2 = 1.4142135623730951;
	go$pkg.SqrtE = 1.6487212707001282;
	go$pkg.SqrtPi = 1.772453850905516;
	go$pkg.SqrtPhi = 1.272019649514069;
	go$pkg.Ln2 = 0.6931471805599453;
	go$pkg.Log2E = 1.4426950408889634;
	go$pkg.Ln10 = 2.302585092994046;
	go$pkg.Log10E = 0.4342944819032518;
	go$pkg.MaxFloat32 = 3.4028234663852886e+38;
	go$pkg.SmallestNonzeroFloat32 = 1.401298464324817e-45;
	go$pkg.MaxFloat64 = 1.7976931348623157e+308;
	go$pkg.SmallestNonzeroFloat64 = 5e-324;
	go$pkg.MaxInt8 = 127;
	go$pkg.MinInt8 = -128;
	go$pkg.MaxInt16 = 32767;
	go$pkg.MinInt16 = -32768;
	go$pkg.MaxInt32 = 2147483647;
	go$pkg.MinInt32 = -2147483648;
	go$pkg.MaxInt64 = 9223372036854775807;
	go$pkg.MinInt64 = -9223372036854775808;
	go$pkg.MaxUint8 = 255;
	go$pkg.MaxUint16 = 65535;
	go$pkg.MaxUint32 = 4294967295;
	go$pkg.MaxUint64 = -1;
	var erx = 0.8450629115104675;
	var efx = 0.1283791670955126;
	var efx8 = 1.0270333367641007;
	var pp0 = 0.12837916709551256;
	var pp1 = -0.3250421072470015;
	var pp2 = -0.02848174957559851;
	var pp3 = -0.005770270296489442;
	var pp4 = -2.3763016656650163e-05;
	var qq1 = 0.39791722395915535;
	var qq2 = 0.0650222499887673;
	var qq3 = 0.005081306281875766;
	var qq4 = 0.00013249473800432164;
	var qq5 = -3.960228278775368e-06;
	var pa0 = -0.0023621185607526594;
	var pa1 = 0.41485611868374833;
	var pa2 = -0.3722078760357013;
	var pa3 = 0.31834661990116175;
	var pa4 = -0.11089469428239668;
	var pa5 = 0.035478304325618236;
	var pa6 = -0.002166375594868791;
	var qa1 = 0.10642088040084423;
	var qa2 = 0.540397917702171;
	var qa3 = 0.07182865441419627;
	var qa4 = 0.12617121980876164;
	var qa5 = 0.01363708391202905;
	var qa6 = 0.011984499846799107;
	var ra0 = -0.009864944034847148;
	var ra1 = -0.6938585727071818;
	var ra2 = -10.558626225323291;
	var ra3 = -62.375332450326006;
	var ra4 = -162.39666946257347;
	var ra5 = -184.60509290671104;
	var ra6 = -81.2874355063066;
	var ra7 = -9.814329344169145;
	var sa1 = 19.651271667439257;
	var sa2 = 137.65775414351904;
	var sa3 = 434.56587747522923;
	var sa4 = 645.3872717332679;
	var sa5 = 429.00814002756783;
	var sa6 = 108.63500554177944;
	var sa7 = 6.570249770319282;
	var sa8 = -0.0604244152148581;
	var rb0 = -0.0098649429247001;
	var rb1 = -0.799283237680523;
	var rb2 = -17.757954917754752;
	var rb3 = -160.63638485582192;
	var rb4 = -637.5664433683896;
	var rb5 = -1025.0951316110772;
	var rb6 = -483.5191916086514;
	var sb1 = 30.33806074348246;
	var sb2 = 325.7925129965739;
	var sb3 = 1536.729586084437;
	var sb4 = 3199.8582195085955;
	var sb5 = 2553.0504064331644;
	var sb6 = 474.52854120695537;
	var sb7 = -22.44095244658582;
	var _gamP = go$makeNativeArray("Float64", 7, function() { return 0; });
	var _gamQ = go$makeNativeArray("Float64", 8, function() { return 0; });
	var _gamS = go$makeNativeArray("Float64", 5, function() { return 0; });
	var p0R8 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p0S8 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var p0R5 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p0S5 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var p0R3 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p0S3 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var p0R2 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p0S2 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var q0R8 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q0S8 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q0R5 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q0S5 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q0R3 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q0S3 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q0R2 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q0S2 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p1R8 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p1S8 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var p1R5 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p1S5 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var p1R3 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p1S3 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var p1R2 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var p1S2 = go$makeNativeArray("Float64", 5, function() { return 0; });
	var q1R8 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q1S8 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q1R5 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q1S5 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q1R3 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q1S3 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q1R2 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var q1S2 = go$makeNativeArray("Float64", 6, function() { return 0; });
	var _lgamA = go$makeNativeArray("Float64", 12, function() { return 0; });
	var _lgamR = go$makeNativeArray("Float64", 7, function() { return 0; });
	var _lgamS = go$makeNativeArray("Float64", 7, function() { return 0; });
	var _lgamT = go$makeNativeArray("Float64", 15, function() { return 0; });
	var _lgamU = go$makeNativeArray("Float64", 6, function() { return 0; });
	var _lgamV = go$makeNativeArray("Float64", 6, function() { return 0; });
	var _lgamW = go$makeNativeArray("Float64", 7, function() { return 0; });
	var pow10tab = go$makeNativeArray("Float64", 70, function() { return 0; });
	var _sin = go$makeNativeArray("Float64", 6, function() { return 0; });
	var _cos = go$makeNativeArray("Float64", 6, function() { return 0; });
	var _tanP = go$makeNativeArray("Float64", 3, function() { return 0; });
	var _tanQ = go$makeNativeArray("Float64", 5, function() { return 0; });
	var tanhP = go$makeNativeArray("Float64", 3, function() { return 0; });
	var tanhQ = go$makeNativeArray("Float64", 3, function() { return 0; });
Abs = Math.abs;
		Acos = Math.acos;
		Asin = Math.asin;
		Atan = Math.atan;
		Atan2 = Math.atan2;
		Ceil = Math.ceil;
		Copysign = function(x, y) { return (x < 0 || 1/x === 1/-0) !== (y < 0 || 1/y === 1/-0) ? -x : x; };
		Cos = Math.cos;
		Dim = function(x, y) { return Math.max(x - y, 0); };
		Exp = Math.exp;
		Exp2 = function(x) { return Math.pow(2, x); };
		Expm1 = expm1;
		Floor = Math.floor;
		Frexp = frexp;
		Hypot = hypot;
		Inf = function(sign) { return sign >= 0 ? 1/0 : -1/0; };
		IsInf = function(f, sign) { if (f === -1/0) { return sign <= 0; } if (f === 1/0) { return sign >= 0; } return false; };
		IsNaN = function(f) { return f !== f; };
		Ldexp = function(frac, exp) {
			if (frac === 0) { return frac; };
			if (exp >= 1024) { return frac * Math.pow(2, 1023) * Math.pow(2, exp - 1023); }
			if (exp <= -1024) { return frac * Math.pow(2, -1023) * Math.pow(2, exp + 1023); }
			return frac * Math.pow(2, exp);
		};
		Log = Math.log;
		Log1p = log1p;
		Log2 = log2;
		Log10 = log10;
		Max = function(x, y) { return (x === 1/0 || y === 1/0) ? 1/0 : Math.max(x, y); };
		Min = function(x, y) { return (x === -1/0 || y === -1/0) ? -1/0 : Math.min(x, y); };
		Mod = function(x, y) { return x % y; };
		Modf = function(f) { if (f === -1/0 || f === 1/0) { return [f, 0/0] } var frac = f % 1; return [f - frac, frac]; };
		NaN = function() { return 0/0; };
		Pow = function(x, y) { return ((x === 1) || (x === -1 && (y === -1/0 || y === 1/0))) ? 1 : Math.pow(x, y); };
		Remainder = remainder;
		Signbit = function(x) { return x < 0 || 1/x === 1/-0; };
		Sin = Math.sin;
		Sincos = function(x) { return [Math.sin(x), Math.cos(x)]; };
		Sqrt = Math.sqrt;
		Tan = Math.tan;
		Trunc = function(x) { return (x === 1/0 || x === -1/0 || x !== x || 1/x === 1/-0) ? x : x >> 0; };

		// generated from bitcasts/bitcasts.go
		Float32bits = go$float32bits;
		Float32frombits = function(b) {
			var s, e, m;
			s = 1;
			if (!(((b & 2147483648) >>> 0) === 0)) {
				s = -1;
			}
			e = (((((b >>> 23) >>> 0)) & 255) >>> 0);
			m = ((b & 8388607) >>> 0);
			if (e === 255) {
				if (m === 0) {
					return s / 0;
				}
				return 0/0;
			}
			if (!(e === 0)) {
				m = (m + (8388608) >>> 0);
			}
			if (e === 0) {
				e = 1;
			}
			return Ldexp(m, e - 127 - 23) * s;
		};
		Float64bits = function(f) {
			var s, e, x, y, x$1, y$1, x$2, y$2;
			if (f === 0) {
				if (f === 0 && 1 / f === 1 / -0) {
					return new Go$Uint64(2147483648, 0);
				}
				return new Go$Uint64(0, 0);
			}
			if (!(f === f)) {
				return new Go$Uint64(2146959360, 1);
			}
			s = new Go$Uint64(0, 0);
			if (f < 0) {
				s = new Go$Uint64(2147483648, 0);
				f = -f;
			}
			e = 1075;
			while (f >= 9.007199254740992e+15) {
				f = f / (2);
				if (e === 2047) {
					break;
				}
				e = (e + (1) >>> 0);
			}
			while (f < 4.503599627370496e+15) {
				e = (e - (1) >>> 0);
				if (e === 0) {
					break;
				}
				f = f * (2);
			}
			return (x$2 = (x = s, y = go$shiftLeft64(new Go$Uint64(0, e), 52), new Go$Uint64(x.high | y.high, (x.low | y.low) >>> 0)), y$2 = ((x$1 = new Go$Uint64(0, f), y$1 = new Go$Uint64(1048576, 0), new Go$Uint64(x$1.high &~ y$1.high, (x$1.low &~ y$1.low) >>> 0))), new Go$Uint64(x$2.high | y$2.high, (x$2.low | y$2.low) >>> 0));
		};
		Float64frombits = function(b) {
			var s, x, y, x$1, y$1, x$2, y$2, e, x$3, y$3, m, x$4, y$4, x$5, y$5, x$6, y$6, x$7, y$7, x$8, y$8;
			s = 1;
			if (!((x$1 = (x = b, y = new Go$Uint64(2147483648, 0), new Go$Uint64(x.high & y.high, (x.low & y.low) >>> 0)), y$1 = new Go$Uint64(0, 0), x$1.high === y$1.high && x$1.low === y$1.low))) {
				s = -1;
			}
			e = (x$2 = (go$shiftRightUint64(b, 52)), y$2 = new Go$Uint64(0, 2047), new Go$Uint64(x$2.high & y$2.high, (x$2.low & y$2.low) >>> 0));
			m = (x$3 = b, y$3 = new Go$Uint64(1048575, 4294967295), new Go$Uint64(x$3.high & y$3.high, (x$3.low & y$3.low) >>> 0));
			if ((x$4 = e, y$4 = new Go$Uint64(0, 2047), x$4.high === y$4.high && x$4.low === y$4.low)) {
				if ((x$5 = m, y$5 = new Go$Uint64(0, 0), x$5.high === y$5.high && x$5.low === y$5.low)) {
					return s / 0;
				}
				return 0/0;
			}
			if (!((x$6 = e, y$6 = new Go$Uint64(0, 0), x$6.high === y$6.high && x$6.low === y$6.low))) {
				m = (x$7 = m, y$7 = (new Go$Uint64(1048576, 0)), new Go$Uint64(x$7.high + y$7.high, x$7.low + y$7.low));
			}
			if ((x$8 = e, y$8 = new Go$Uint64(0, 0), x$8.high === y$8.high && x$8.low === y$8.low)) {
				e = new Go$Uint64(0, 1);
			}
			return Ldexp((m.high * 4294967296 + m.low), e.low - 1023 - 52) * s;
		};
	go$pkg.Abs = Abs;
	go$pkg.Acosh = Acosh;
	go$pkg.Asin = Asin;
	go$pkg.Acos = Acos;
	go$pkg.Asinh = Asinh;
	go$pkg.Atan = Atan;
	go$pkg.Atan2 = Atan2;
	go$pkg.Atanh = Atanh;
	go$pkg.Inf = Inf;
	go$pkg.NaN = NaN;
	go$pkg.IsNaN = IsNaN;
	go$pkg.IsInf = IsInf;
	go$pkg.Cbrt = Cbrt;
	go$pkg.Copysign = Copysign;
	go$pkg.Dim = Dim;
	go$pkg.Max = Max;
	go$pkg.Min = Min;
	go$pkg.Erf = Erf;
	go$pkg.Erfc = Erfc;
	go$pkg.Exp = Exp;
	go$pkg.Exp2 = Exp2;
	go$pkg.Expm1 = Expm1;
	go$pkg.Floor = Floor;
	go$pkg.Ceil = Ceil;
	go$pkg.Trunc = Trunc;
	go$pkg.Frexp = Frexp;
	go$pkg.Gamma = Gamma;
	go$pkg.Hypot = Hypot;
	go$pkg.J0 = J0;
	go$pkg.Y0 = Y0;
	go$pkg.J1 = J1;
	go$pkg.Y1 = Y1;
	go$pkg.Jn = Jn;
	go$pkg.Yn = Yn;
	go$pkg.Ldexp = Ldexp;
	go$pkg.Lgamma = Lgamma;
	go$pkg.Log = Log;
	go$pkg.Log10 = Log10;
	go$pkg.Log2 = Log2;
	go$pkg.Log1p = Log1p;
	go$pkg.Logb = Logb;
	go$pkg.Ilogb = Ilogb;
	go$pkg.Mod = Mod;
	go$pkg.Modf = Modf;
	go$pkg.Nextafter = Nextafter;
	go$pkg.Pow = Pow;
	go$pkg.Pow10 = Pow10;
	go$pkg.Remainder = Remainder;
	go$pkg.Signbit = Signbit;
	go$pkg.Cos = Cos;
	go$pkg.Sin = Sin;
	go$pkg.Sincos = Sincos;
	go$pkg.Sinh = Sinh;
	go$pkg.Cosh = Cosh;
	go$pkg.Sqrt = Sqrt;
	go$pkg.Tan = Tan;
	go$pkg.Tanh = Tanh;
	go$pkg.Float32bits = Float32bits;
	go$pkg.Float32frombits = Float32frombits;
	go$pkg.Float64bits = Float64bits;
	go$pkg.Float64frombits = Float64frombits;
	go$pkg.init = function() {
		var i, _q, m;
		_gamP = go$toNativeArray("Float64", [0.00016011952247675185, 0.0011913514700658638, 0.010421379756176158, 0.04763678004571372, 0.20744822764843598, 0.4942148268014971, 1]);
		_gamQ = go$toNativeArray("Float64", [-2.3158187332412014e-05, 0.0005396055804933034, -0.004456419138517973, 0.011813978522206043, 0.035823639860549865, -0.23459179571824335, 0.0714304917030273, 1]);
		_gamS = go$toNativeArray("Float64", [0.0007873113957930937, -0.00022954996161337813, -0.0026813261780578124, 0.0034722222160545866, 0.08333333333334822]);
		p0R8 = go$toNativeArray("Float64", [0, -0.07031249999999004, -8.081670412753498, -257.06310567970485, -2485.216410094288, -5253.043804907295]);
		p0S8 = go$toNativeArray("Float64", [116.53436461966818, 3833.7447536412183, 40597.857264847255, 116752.97256437592, 47627.728414673096]);
		p0R5 = go$toNativeArray("Float64", [-1.141254646918945e-11, -0.07031249408735993, -4.159610644705878, -67.67476522651673, -331.23129964917297, -346.4333883656049]);
		p0S5 = go$toNativeArray("Float64", [60.753938269230034, 1051.2523059570458, 5978.970943338558, 9625.445143577745, 2406.058159229391]);
		p0R3 = go$toNativeArray("Float64", [-2.547046017719519e-09, -0.07031196163814817, -2.409032215495296, -21.96597747348831, -58.07917047017376, -31.44794705948885]);
		p0S3 = go$toNativeArray("Float64", [35.85603380552097, 361.51398305030386, 1193.6078379211153, 1127.9967985690741, 173.58093081333575]);
		p0R2 = go$toNativeArray("Float64", [-8.875343330325264e-08, -0.07030309954836247, -1.4507384678095299, -7.635696138235278, -11.193166886035675, -3.2336457935133534]);
		p0S2 = go$toNativeArray("Float64", [22.22029975320888, 136.2067942182152, 270.4702786580835, 153.87539420832033, 14.65761769482562]);
		q0R8 = go$toNativeArray("Float64", [0, 0.0732421874999935, 11.76820646822527, 557.6733802564019, 8859.197207564686, 37014.62677768878]);
		q0S8 = go$toNativeArray("Float64", [163.77602689568982, 8098.344946564498, 142538.29141912048, 803309.2571195144, 840501.5798190605, -343899.2935378666]);
		q0R5 = go$toNativeArray("Float64", [1.8408596359451553e-11, 0.07324217666126848, 5.8356350896205695, 135.11157728644983, 1027.243765961641, 1989.9778586460538]);
		q0S5 = go$toNativeArray("Float64", [82.77661022365378, 2077.81416421393, 18847.28877857181, 56751.11228949473, 35976.75384251145, -5354.342756019448]);
		q0R3 = go$toNativeArray("Float64", [4.377410140897386e-09, 0.07324111800429114, 3.344231375161707, 42.621844074541265, 170.8080913405656, 166.73394869665117]);
		q0S3 = go$toNativeArray("Float64", [48.75887297245872, 709.689221056606, 3704.1482262011136, 6460.425167525689, 2516.3336892036896, -149.2474518361564]);
		q0R2 = go$toNativeArray("Float64", [1.5044444488698327e-07, 0.07322342659630793, 1.99819174093816, 14.495602934788574, 31.666231750478154, 16.252707571092927]);
		q0S2 = go$toNativeArray("Float64", [30.36558483552192, 269.34811860804984, 844.7837575953201, 882.9358451124886, 212.66638851179883, -5.3109549388266695]);
		p1R8 = go$toNativeArray("Float64", [0, 0.11718749999998865, 13.239480659307358, 412.05185430737856, 3874.7453891396053, 7914.479540318917]);
		p1S8 = go$toNativeArray("Float64", [114.20737037567841, 3650.9308342085346, 36956.206026903346, 97602.79359349508, 30804.27206278888]);
		p1R5 = go$toNativeArray("Float64", [1.3199051955624352e-11, 0.1171874931906141, 6.802751278684329, 108.30818299018911, 517.6361395331998, 528.7152013633375]);
		p1S5 = go$toNativeArray("Float64", [59.28059872211313, 991.4014187336144, 5353.26695291488, 7844.690317495512, 1504.0468881036106]);
		p1R3 = go$toNativeArray("Float64", [3.025039161373736e-09, 0.11718686556725359, 3.9329775003331564, 35.11940355916369, 91.05501107507813, 48.55906851973649]);
		p1S3 = go$toNativeArray("Float64", [34.79130950012515, 336.76245874782575, 1046.8713997577513, 890.8113463982564, 103.78793243963928]);
		p1R2 = go$toNativeArray("Float64", [1.0771083010687374e-07, 0.11717621946268335, 2.368514966676088, 12.242610914826123, 17.693971127168773, 5.073523125888185]);
		p1S2 = go$toNativeArray("Float64", [21.43648593638214, 125.29022716840275, 232.2764690571628, 117.6793732871471, 8.364638933716183]);
		q1R8 = go$toNativeArray("Float64", [0, -0.10253906249999271, -16.271753454459, -759.6017225139501, -11849.806670242959, -48438.512428575035]);
		q1S8 = go$toNativeArray("Float64", [161.3953697007229, 7825.385999233485, 133875.33628724958, 719657.7236832409, 666601.2326177764, -294490.26430383464]);
		q1R5 = go$toNativeArray("Float64", [-2.089799311417641e-11, -0.10253905024137543, -8.05644828123936, -183.66960747488838, -1373.1937606550816, -2612.4444045321566]);
		q1S5 = go$toNativeArray("Float64", [81.27655013843358, 1991.7987346048596, 17468.48519249089, 49851.42709103523, 27948.075163891812, -4719.183547951285]);
		q1R3 = go$toNativeArray("Float64", [-5.078312264617666e-09, -0.10253782982083709, -4.610115811394734, -57.847221656278364, -228.2445407376317, -219.21012847890933]);
		q1S3 = go$toNativeArray("Float64", [47.66515503237295, 673.8651126766997, 3380.1528667952634, 5547.729097207228, 1903.119193388108, -135.20119144430734]);
		q1R2 = go$toNativeArray("Float64", [-1.7838172751095887e-07, -0.10251704260798555, -2.7522056827818746, -19.663616264370372, -42.32531333728305, -21.371921170370406]);
		q1S2 = go$toNativeArray("Float64", [29.533362906052385, 252.98154998219053, 757.5028348686454, 739.3932053204672, 155.94900333666612, -4.959498988226282]);
		_lgamA = go$toNativeArray("Float64", [0.07721566490153287, 0.3224670334241136, 0.06735230105312927, 0.020580808432516733, 0.007385550860814029, 0.0028905138367341563, 0.0011927076318336207, 0.0005100697921535113, 0.00022086279071390839, 0.00010801156724758394, 2.5214456545125733e-05, 4.4864094961891516e-05]);
		_lgamR = go$toNativeArray("Float64", [1, 1.3920053346762105, 0.7219355475671381, 0.17193386563280308, 0.01864591917156529, 0.0007779424963818936, 7.326684307446256e-06]);
		_lgamS = go$toNativeArray("Float64", [-0.07721566490153287, 0.21498241596060885, 0.325778796408931, 0.14635047265246445, 0.02664227030336386, 0.0018402845140733772, 3.194753265841009e-05]);
		_lgamT = go$toNativeArray("Float64", [0.48383612272381005, -0.1475877229945939, 0.06462494023913339, -0.032788541075985965, 0.01797067508118204, -0.010314224129834144, 0.006100538702462913, -0.0036845201678113826, 0.0022596478090061247, -0.0014034646998923284, 0.000881081882437654, -0.0005385953053567405, 0.00031563207090362595, -0.00031275416837512086, 0.0003355291926355191]);
		_lgamU = go$toNativeArray("Float64", [-0.07721566490153287, 0.6328270640250934, 1.4549225013723477, 0.9777175279633727, 0.22896372806469245, 0.013381091853678766]);
		_lgamV = go$toNativeArray("Float64", [1, 2.4559779371304113, 2.128489763798934, 0.7692851504566728, 0.10422264559336913, 0.003217092422824239]);
		_lgamW = go$toNativeArray("Float64", [0.4189385332046727, 0.08333333333333297, -0.0027777777772877554, 0.0007936505586430196, -0.00059518755745034, 0.0008363399189962821, -0.0016309293409657527]);
		_sin = go$toNativeArray("Float64", [1.5896230157654656e-10, -2.5050747762857807e-08, 2.7557313621385722e-06, -0.0001984126982958954, 0.008333333333322118, -0.1666666666666663]);
		_cos = go$toNativeArray("Float64", [-1.1358536521387682e-11, 2.087570084197473e-09, -2.755731417929674e-07, 2.4801587288851704e-05, -0.0013888888888873056, 0.041666666666666595]);
		_tanP = go$toNativeArray("Float64", [-13093.693918138379, 1.1535166483858742e+06, -1.7956525197648488e+07]);
		_tanQ = go$toNativeArray("Float64", [1, 13681.296347069296, -1.3208923444021097e+06, 2.500838018233579e+07, -5.3869575592945464e+07]);
		tanhP = go$toNativeArray("Float64", [-0.9643991794250523, -99.28772310019185, -1614.6876844170845]);
		tanhQ = go$toNativeArray("Float64", [112.81167849163293, 2235.4883906010045, 4844.063053251255]);
		pow10tab[0] = 1;
		pow10tab[1] = 10;
		i = 2;
		while (i < 70) {
			m = (_q = i / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			pow10tab[i] = pow10tab[m] * pow10tab[(i - m >> 0)];
			i = (i + 1 >> 0);
		}
	};
  return go$pkg;
})();
go$packages["github.com/ajhager/enj"] = (function() {
  var go$pkg = {};
	var js = go$packages["github.com/neelance/gopherjs/js"];
	var webgl = go$packages["github.com/ajhager/webgl"];
	var math = go$packages["math"];
	var Assets;
	Assets = go$newType(0, "Struct", "enj.Assets", "Assets", "github.com/ajhager/enj", function(queue_, cache_, loads_, errors_) {
		this.go$val = this;
		this.queue = queue_ !== undefined ? queue_ : (go$sliceType(Go$String)).nil;
		this.cache = cache_ !== undefined ? cache_ : false;
		this.loads = loads_ !== undefined ? loads_ : 0;
		this.errors = errors_ !== undefined ? errors_ : 0;
	});
	go$pkg.Assets = Assets;
	var Batch;
	Batch = go$newType(0, "Struct", "enj.Batch", "Batch", "github.com/ajhager/enj", function(gl_, drawing_, lastTexture_, color_, vertices_, vertexVBO_, indices_, indexVBO_, index_, shader_, customShader_, blendingDisabled_, blendSrcFunc_, blendDstFunc_, inPosition_, inColor_, inTexCoords_, ufProjection_, projX_, projY_) {
		this.go$val = this;
		this.gl = gl_ !== undefined ? gl_ : (go$ptrType(Canvas)).nil;
		this.drawing = drawing_ !== undefined ? drawing_ : false;
		this.lastTexture = lastTexture_ !== undefined ? lastTexture_ : (go$ptrType(Texture)).nil;
		this.color = color_ !== undefined ? color_ : 0;
		this.vertices = vertices_ !== undefined ? vertices_ : null;
		this.vertexVBO = vertexVBO_ !== undefined ? vertexVBO_ : null;
		this.indices = indices_ !== undefined ? indices_ : null;
		this.indexVBO = indexVBO_ !== undefined ? indexVBO_ : null;
		this.index = index_ !== undefined ? index_ : 0;
		this.shader = shader_ !== undefined ? shader_ : (go$ptrType(Shader)).nil;
		this.customShader = customShader_ !== undefined ? customShader_ : (go$ptrType(Shader)).nil;
		this.blendingDisabled = blendingDisabled_ !== undefined ? blendingDisabled_ : false;
		this.blendSrcFunc = blendSrcFunc_ !== undefined ? blendSrcFunc_ : 0;
		this.blendDstFunc = blendDstFunc_ !== undefined ? blendDstFunc_ : 0;
		this.inPosition = inPosition_ !== undefined ? inPosition_ : 0;
		this.inColor = inColor_ !== undefined ? inColor_ : 0;
		this.inTexCoords = inTexCoords_ !== undefined ? inTexCoords_ : 0;
		this.ufProjection = ufProjection_ !== undefined ? ufProjection_ : null;
		this.projX = projX_ !== undefined ? projX_ : 0;
		this.projY = projY_ !== undefined ? projY_ : 0;
	});
	go$pkg.Batch = Batch;
	var Managed;
	Managed = go$newType(0, "Interface", "enj.Managed", "Managed", "github.com/ajhager/enj", null);
	go$pkg.Managed = Managed;
	var Canvas;
	Canvas = go$newType(0, "Struct", "enj.Canvas", "Canvas", "github.com/ajhager/enj", function(Object_, Context_, attrs_, width_, height_, pixelRatio_, fullscreen_, resources_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.Context = Context_ !== undefined ? Context_ : (go$ptrType(webgl.Context)).nil;
		this.attrs = attrs_ !== undefined ? attrs_ : (go$ptrType(webgl.ContextAttributes)).nil;
		this.width = width_ !== undefined ? width_ : 0;
		this.height = height_ !== undefined ? height_ : 0;
		this.pixelRatio = pixelRatio_ !== undefined ? pixelRatio_ : 0;
		this.fullscreen = fullscreen_ !== undefined ? fullscreen_ : false;
		this.resources = resources_ !== undefined ? resources_ : (go$sliceType(Managed)).nil;
	});
	Canvas.prototype.Bool = function() { return this.go$val.Bool(); };
	Canvas.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Canvas.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Canvas.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Canvas.prototype.Float = function() { return this.go$val.Float(); };
	Canvas.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Canvas.prototype.Get = function(name) { return this.go$val.Get(name); };
	Canvas.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Canvas.prototype.Index = function(i) { return this.go$val.Index(i); };
	Canvas.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Canvas.prototype.Int = function() { return this.go$val.Int(); };
	Canvas.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Canvas.prototype.Interface = function() { return this.go$val.Interface(); };
	Canvas.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Canvas.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Canvas.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Canvas.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Canvas.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Canvas.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Canvas.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Canvas.prototype.Length = function() { return this.go$val.Length(); };
	Canvas.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Canvas.prototype.New = function(args) { return this.go$val.New(args); };
	Canvas.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Canvas.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Canvas.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Canvas.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Canvas.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Canvas.prototype.String = function() { return this.go$val.String(); };
	Canvas.Ptr.prototype.String = function() { return this.Object.String(); };
	Canvas.prototype.ActiveTexture = function(texture) { return this.go$val.ActiveTexture(texture); };
	Canvas.Ptr.prototype.ActiveTexture = function(texture) { return this.Context.ActiveTexture(texture); };
	Canvas.prototype.AttachShader = function(program, shader) { return this.go$val.AttachShader(program, shader); };
	Canvas.Ptr.prototype.AttachShader = function(program, shader) { return this.Context.AttachShader(program, shader); };
	Canvas.prototype.BindAttribLocation = function(program, index, name) { return this.go$val.BindAttribLocation(program, index, name); };
	Canvas.Ptr.prototype.BindAttribLocation = function(program, index, name) { return this.Context.BindAttribLocation(program, index, name); };
	Canvas.prototype.BindBuffer = function(target, buffer) { return this.go$val.BindBuffer(target, buffer); };
	Canvas.Ptr.prototype.BindBuffer = function(target, buffer) { return this.Context.BindBuffer(target, buffer); };
	Canvas.prototype.BindFramebuffer = function(target, framebuffer) { return this.go$val.BindFramebuffer(target, framebuffer); };
	Canvas.Ptr.prototype.BindFramebuffer = function(target, framebuffer) { return this.Context.BindFramebuffer(target, framebuffer); };
	Canvas.prototype.BindRenderbuffer = function(target, renderbuffer) { return this.go$val.BindRenderbuffer(target, renderbuffer); };
	Canvas.Ptr.prototype.BindRenderbuffer = function(target, renderbuffer) { return this.Context.BindRenderbuffer(target, renderbuffer); };
	Canvas.prototype.BindTexture = function(target, texture) { return this.go$val.BindTexture(target, texture); };
	Canvas.Ptr.prototype.BindTexture = function(target, texture) { return this.Context.BindTexture(target, texture); };
	Canvas.prototype.BlendColor = function(r, g, b, a) { return this.go$val.BlendColor(r, g, b, a); };
	Canvas.Ptr.prototype.BlendColor = function(r, g, b, a) { return this.Context.BlendColor(r, g, b, a); };
	Canvas.prototype.BlendEquation = function(mode) { return this.go$val.BlendEquation(mode); };
	Canvas.Ptr.prototype.BlendEquation = function(mode) { return this.Context.BlendEquation(mode); };
	Canvas.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) { return this.go$val.BlendEquationSeparate(modeRGB, modeAlpha); };
	Canvas.Ptr.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) { return this.Context.BlendEquationSeparate(modeRGB, modeAlpha); };
	Canvas.prototype.BlendFunc = function(sfactor, dfactor) { return this.go$val.BlendFunc(sfactor, dfactor); };
	Canvas.Ptr.prototype.BlendFunc = function(sfactor, dfactor) { return this.Context.BlendFunc(sfactor, dfactor); };
	Canvas.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) { return this.go$val.BlendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha); };
	Canvas.Ptr.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) { return this.Context.BlendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha); };
	Canvas.prototype.Bool = function() { return this.go$val.Bool(); };
	Canvas.Ptr.prototype.Bool = function() { return this.Context.Bool(); };
	Canvas.prototype.BufferData = function(target, data, usage) { return this.go$val.BufferData(target, data, usage); };
	Canvas.Ptr.prototype.BufferData = function(target, data, usage) { return this.Context.BufferData(target, data, usage); };
	Canvas.prototype.BufferSubData = function(target, offset, data) { return this.go$val.BufferSubData(target, offset, data); };
	Canvas.Ptr.prototype.BufferSubData = function(target, offset, data) { return this.Context.BufferSubData(target, offset, data); };
	Canvas.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Canvas.Ptr.prototype.Call = function(name, args) { return this.Context.Call(name, args); };
	Canvas.prototype.CheckFramebufferStatus = function(target) { return this.go$val.CheckFramebufferStatus(target); };
	Canvas.Ptr.prototype.CheckFramebufferStatus = function(target) { return this.Context.CheckFramebufferStatus(target); };
	Canvas.prototype.Clear = function(flags) { return this.go$val.Clear(flags); };
	Canvas.Ptr.prototype.Clear = function(flags) { return this.Context.Clear(flags); };
	Canvas.prototype.ClearColor = function(r, g, b, a) { return this.go$val.ClearColor(r, g, b, a); };
	Canvas.Ptr.prototype.ClearColor = function(r, g, b, a) { return this.Context.ClearColor(r, g, b, a); };
	Canvas.prototype.ClearDepth = function(depth) { return this.go$val.ClearDepth(depth); };
	Canvas.Ptr.prototype.ClearDepth = function(depth) { return this.Context.ClearDepth(depth); };
	Canvas.prototype.ClearStencil = function(s) { return this.go$val.ClearStencil(s); };
	Canvas.Ptr.prototype.ClearStencil = function(s) { return this.Context.ClearStencil(s); };
	Canvas.prototype.ColorMask = function(r, g, b, a) { return this.go$val.ColorMask(r, g, b, a); };
	Canvas.Ptr.prototype.ColorMask = function(r, g, b, a) { return this.Context.ColorMask(r, g, b, a); };
	Canvas.prototype.CompileShader = function(shader) { return this.go$val.CompileShader(shader); };
	Canvas.Ptr.prototype.CompileShader = function(shader) { return this.Context.CompileShader(shader); };
	Canvas.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) { return this.go$val.CopyTexImage2D(target, level, internal, x, y, w, h, border); };
	Canvas.Ptr.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) { return this.Context.CopyTexImage2D(target, level, internal, x, y, w, h, border); };
	Canvas.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) { return this.go$val.CopyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h); };
	Canvas.Ptr.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) { return this.Context.CopyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h); };
	Canvas.prototype.CreateBuffer = function() { return this.go$val.CreateBuffer(); };
	Canvas.Ptr.prototype.CreateBuffer = function() { return this.Context.CreateBuffer(); };
	Canvas.prototype.CreateFramebuffer = function() { return this.go$val.CreateFramebuffer(); };
	Canvas.Ptr.prototype.CreateFramebuffer = function() { return this.Context.CreateFramebuffer(); };
	Canvas.prototype.CreateProgram = function() { return this.go$val.CreateProgram(); };
	Canvas.Ptr.prototype.CreateProgram = function() { return this.Context.CreateProgram(); };
	Canvas.prototype.CreateRenderbuffer = function() { return this.go$val.CreateRenderbuffer(); };
	Canvas.Ptr.prototype.CreateRenderbuffer = function() { return this.Context.CreateRenderbuffer(); };
	Canvas.prototype.CreateShader = function(typ) { return this.go$val.CreateShader(typ); };
	Canvas.Ptr.prototype.CreateShader = function(typ) { return this.Context.CreateShader(typ); };
	Canvas.prototype.CreateTexture = function() { return this.go$val.CreateTexture(); };
	Canvas.Ptr.prototype.CreateTexture = function() { return this.Context.CreateTexture(); };
	Canvas.prototype.CullFace = function(mode) { return this.go$val.CullFace(mode); };
	Canvas.Ptr.prototype.CullFace = function(mode) { return this.Context.CullFace(mode); };
	Canvas.prototype.DeleteBuffer = function(buffer) { return this.go$val.DeleteBuffer(buffer); };
	Canvas.Ptr.prototype.DeleteBuffer = function(buffer) { return this.Context.DeleteBuffer(buffer); };
	Canvas.prototype.DeleteFramebuffer = function(framebuffer) { return this.go$val.DeleteFramebuffer(framebuffer); };
	Canvas.Ptr.prototype.DeleteFramebuffer = function(framebuffer) { return this.Context.DeleteFramebuffer(framebuffer); };
	Canvas.prototype.DeleteProgram = function(program) { return this.go$val.DeleteProgram(program); };
	Canvas.Ptr.prototype.DeleteProgram = function(program) { return this.Context.DeleteProgram(program); };
	Canvas.prototype.DeleteRenderbuffer = function(renderbuffer) { return this.go$val.DeleteRenderbuffer(renderbuffer); };
	Canvas.Ptr.prototype.DeleteRenderbuffer = function(renderbuffer) { return this.Context.DeleteRenderbuffer(renderbuffer); };
	Canvas.prototype.DeleteShader = function(shader) { return this.go$val.DeleteShader(shader); };
	Canvas.Ptr.prototype.DeleteShader = function(shader) { return this.Context.DeleteShader(shader); };
	Canvas.prototype.DeleteTexture = function(texture) { return this.go$val.DeleteTexture(texture); };
	Canvas.Ptr.prototype.DeleteTexture = function(texture) { return this.Context.DeleteTexture(texture); };
	Canvas.prototype.DepthFunc = function(fun) { return this.go$val.DepthFunc(fun); };
	Canvas.Ptr.prototype.DepthFunc = function(fun) { return this.Context.DepthFunc(fun); };
	Canvas.prototype.DepthMask = function(flag) { return this.go$val.DepthMask(flag); };
	Canvas.Ptr.prototype.DepthMask = function(flag) { return this.Context.DepthMask(flag); };
	Canvas.prototype.DepthRange = function(zNear, zFar) { return this.go$val.DepthRange(zNear, zFar); };
	Canvas.Ptr.prototype.DepthRange = function(zNear, zFar) { return this.Context.DepthRange(zNear, zFar); };
	Canvas.prototype.DetachShader = function(program, shader) { return this.go$val.DetachShader(program, shader); };
	Canvas.Ptr.prototype.DetachShader = function(program, shader) { return this.Context.DetachShader(program, shader); };
	Canvas.prototype.Disable = function(cap) { return this.go$val.Disable(cap); };
	Canvas.Ptr.prototype.Disable = function(cap) { return this.Context.Disable(cap); };
	Canvas.prototype.DisableVertexAttribArray = function(index) { return this.go$val.DisableVertexAttribArray(index); };
	Canvas.Ptr.prototype.DisableVertexAttribArray = function(index) { return this.Context.DisableVertexAttribArray(index); };
	Canvas.prototype.DrawArrays = function(mode, first, count) { return this.go$val.DrawArrays(mode, first, count); };
	Canvas.Ptr.prototype.DrawArrays = function(mode, first, count) { return this.Context.DrawArrays(mode, first, count); };
	Canvas.prototype.DrawElements = function(mode, count, typ, offset) { return this.go$val.DrawElements(mode, count, typ, offset); };
	Canvas.Ptr.prototype.DrawElements = function(mode, count, typ, offset) { return this.Context.DrawElements(mode, count, typ, offset); };
	Canvas.prototype.Enable = function(cap) { return this.go$val.Enable(cap); };
	Canvas.Ptr.prototype.Enable = function(cap) { return this.Context.Enable(cap); };
	Canvas.prototype.EnableVertexAttribArray = function(index) { return this.go$val.EnableVertexAttribArray(index); };
	Canvas.Ptr.prototype.EnableVertexAttribArray = function(index) { return this.Context.EnableVertexAttribArray(index); };
	Canvas.prototype.Finish = function() { return this.go$val.Finish(); };
	Canvas.Ptr.prototype.Finish = function() { return this.Context.Finish(); };
	Canvas.prototype.Float = function() { return this.go$val.Float(); };
	Canvas.Ptr.prototype.Float = function() { return this.Context.Float(); };
	Canvas.prototype.Flush = function() { return this.go$val.Flush(); };
	Canvas.Ptr.prototype.Flush = function() { return this.Context.Flush(); };
	Canvas.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) { return this.go$val.FrameBufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer); };
	Canvas.Ptr.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) { return this.Context.FrameBufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer); };
	Canvas.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) { return this.go$val.FramebufferTexture2D(target, attachment, textarget, texture, level); };
	Canvas.Ptr.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) { return this.Context.FramebufferTexture2D(target, attachment, textarget, texture, level); };
	Canvas.prototype.FrontFace = function(mode) { return this.go$val.FrontFace(mode); };
	Canvas.Ptr.prototype.FrontFace = function(mode) { return this.Context.FrontFace(mode); };
	Canvas.prototype.GenerateMipmap = function(target) { return this.go$val.GenerateMipmap(target); };
	Canvas.Ptr.prototype.GenerateMipmap = function(target) { return this.Context.GenerateMipmap(target); };
	Canvas.prototype.Get = function(name) { return this.go$val.Get(name); };
	Canvas.Ptr.prototype.Get = function(name) { return this.Context.Get(name); };
	Canvas.prototype.GetActiveAttrib = function(program, index) { return this.go$val.GetActiveAttrib(program, index); };
	Canvas.Ptr.prototype.GetActiveAttrib = function(program, index) { return this.Context.GetActiveAttrib(program, index); };
	Canvas.prototype.GetActiveUniform = function(program, index) { return this.go$val.GetActiveUniform(program, index); };
	Canvas.Ptr.prototype.GetActiveUniform = function(program, index) { return this.Context.GetActiveUniform(program, index); };
	Canvas.prototype.GetAttachedShaders = function(program) { return this.go$val.GetAttachedShaders(program); };
	Canvas.Ptr.prototype.GetAttachedShaders = function(program) { return this.Context.GetAttachedShaders(program); };
	Canvas.prototype.GetAttribLocation = function(program, name) { return this.go$val.GetAttribLocation(program, name); };
	Canvas.Ptr.prototype.GetAttribLocation = function(program, name) { return this.Context.GetAttribLocation(program, name); };
	Canvas.prototype.GetBufferParameter = function(target, pname) { return this.go$val.GetBufferParameter(target, pname); };
	Canvas.Ptr.prototype.GetBufferParameter = function(target, pname) { return this.Context.GetBufferParameter(target, pname); };
	Canvas.prototype.GetContextAttributes = function() { return this.go$val.GetContextAttributes(); };
	Canvas.Ptr.prototype.GetContextAttributes = function() { return this.Context.GetContextAttributes(); };
	Canvas.prototype.GetError = function() { return this.go$val.GetError(); };
	Canvas.Ptr.prototype.GetError = function() { return this.Context.GetError(); };
	Canvas.prototype.GetExtension = function(name) { return this.go$val.GetExtension(name); };
	Canvas.Ptr.prototype.GetExtension = function(name) { return this.Context.GetExtension(name); };
	Canvas.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) { return this.go$val.GetFramebufferAttachmentParameter(target, attachment, pname); };
	Canvas.Ptr.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) { return this.Context.GetFramebufferAttachmentParameter(target, attachment, pname); };
	Canvas.prototype.GetParameter = function(pname) { return this.go$val.GetParameter(pname); };
	Canvas.Ptr.prototype.GetParameter = function(pname) { return this.Context.GetParameter(pname); };
	Canvas.prototype.GetProgramInfoLog = function(program) { return this.go$val.GetProgramInfoLog(program); };
	Canvas.Ptr.prototype.GetProgramInfoLog = function(program) { return this.Context.GetProgramInfoLog(program); };
	Canvas.prototype.GetProgramParameterb = function(program, pname) { return this.go$val.GetProgramParameterb(program, pname); };
	Canvas.Ptr.prototype.GetProgramParameterb = function(program, pname) { return this.Context.GetProgramParameterb(program, pname); };
	Canvas.prototype.GetProgramParameteri = function(program, pname) { return this.go$val.GetProgramParameteri(program, pname); };
	Canvas.Ptr.prototype.GetProgramParameteri = function(program, pname) { return this.Context.GetProgramParameteri(program, pname); };
	Canvas.prototype.GetRenderbufferParameter = function(target, pname) { return this.go$val.GetRenderbufferParameter(target, pname); };
	Canvas.Ptr.prototype.GetRenderbufferParameter = function(target, pname) { return this.Context.GetRenderbufferParameter(target, pname); };
	Canvas.prototype.GetShaderInfoLog = function(shader) { return this.go$val.GetShaderInfoLog(shader); };
	Canvas.Ptr.prototype.GetShaderInfoLog = function(shader) { return this.Context.GetShaderInfoLog(shader); };
	Canvas.prototype.GetShaderParameter = function(shader, pname) { return this.go$val.GetShaderParameter(shader, pname); };
	Canvas.Ptr.prototype.GetShaderParameter = function(shader, pname) { return this.Context.GetShaderParameter(shader, pname); };
	Canvas.prototype.GetShaderParameterb = function(shader, pname) { return this.go$val.GetShaderParameterb(shader, pname); };
	Canvas.Ptr.prototype.GetShaderParameterb = function(shader, pname) { return this.Context.GetShaderParameterb(shader, pname); };
	Canvas.prototype.GetShaderSource = function(shader) { return this.go$val.GetShaderSource(shader); };
	Canvas.Ptr.prototype.GetShaderSource = function(shader) { return this.Context.GetShaderSource(shader); };
	Canvas.prototype.GetSupportedExtensions = function() { return this.go$val.GetSupportedExtensions(); };
	Canvas.Ptr.prototype.GetSupportedExtensions = function() { return this.Context.GetSupportedExtensions(); };
	Canvas.prototype.GetTexParameter = function(target, pname) { return this.go$val.GetTexParameter(target, pname); };
	Canvas.Ptr.prototype.GetTexParameter = function(target, pname) { return this.Context.GetTexParameter(target, pname); };
	Canvas.prototype.GetUniform = function(program, location) { return this.go$val.GetUniform(program, location); };
	Canvas.Ptr.prototype.GetUniform = function(program, location) { return this.Context.GetUniform(program, location); };
	Canvas.prototype.GetUniformLocation = function(program, name) { return this.go$val.GetUniformLocation(program, name); };
	Canvas.Ptr.prototype.GetUniformLocation = function(program, name) { return this.Context.GetUniformLocation(program, name); };
	Canvas.prototype.GetVertexAttrib = function(index, pname) { return this.go$val.GetVertexAttrib(index, pname); };
	Canvas.Ptr.prototype.GetVertexAttrib = function(index, pname) { return this.Context.GetVertexAttrib(index, pname); };
	Canvas.prototype.GetVertexAttribOffset = function(index, pname) { return this.go$val.GetVertexAttribOffset(index, pname); };
	Canvas.Ptr.prototype.GetVertexAttribOffset = function(index, pname) { return this.Context.GetVertexAttribOffset(index, pname); };
	Canvas.prototype.Index = function(i) { return this.go$val.Index(i); };
	Canvas.Ptr.prototype.Index = function(i) { return this.Context.Index(i); };
	Canvas.prototype.Int = function() { return this.go$val.Int(); };
	Canvas.Ptr.prototype.Int = function() { return this.Context.Int(); };
	Canvas.prototype.Interface = function() { return this.go$val.Interface(); };
	Canvas.Ptr.prototype.Interface = function() { return this.Context.Interface(); };
	Canvas.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Canvas.Ptr.prototype.Invoke = function(args) { return this.Context.Invoke(args); };
	Canvas.prototype.IsBuffer = function(buffer) { return this.go$val.IsBuffer(buffer); };
	Canvas.Ptr.prototype.IsBuffer = function(buffer) { return this.Context.IsBuffer(buffer); };
	Canvas.prototype.IsContextLost = function() { return this.go$val.IsContextLost(); };
	Canvas.Ptr.prototype.IsContextLost = function() { return this.Context.IsContextLost(); };
	Canvas.prototype.IsEnabled = function(capability) { return this.go$val.IsEnabled(capability); };
	Canvas.Ptr.prototype.IsEnabled = function(capability) { return this.Context.IsEnabled(capability); };
	Canvas.prototype.IsFramebuffer = function(framebuffer) { return this.go$val.IsFramebuffer(framebuffer); };
	Canvas.Ptr.prototype.IsFramebuffer = function(framebuffer) { return this.Context.IsFramebuffer(framebuffer); };
	Canvas.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Canvas.Ptr.prototype.IsNull = function() { return this.Context.IsNull(); };
	Canvas.prototype.IsProgram = function(program) { return this.go$val.IsProgram(program); };
	Canvas.Ptr.prototype.IsProgram = function(program) { return this.Context.IsProgram(program); };
	Canvas.prototype.IsRenderbuffer = function(renderbuffer) { return this.go$val.IsRenderbuffer(renderbuffer); };
	Canvas.Ptr.prototype.IsRenderbuffer = function(renderbuffer) { return this.Context.IsRenderbuffer(renderbuffer); };
	Canvas.prototype.IsShader = function(shader) { return this.go$val.IsShader(shader); };
	Canvas.Ptr.prototype.IsShader = function(shader) { return this.Context.IsShader(shader); };
	Canvas.prototype.IsTexture = function(texture) { return this.go$val.IsTexture(texture); };
	Canvas.Ptr.prototype.IsTexture = function(texture) { return this.Context.IsTexture(texture); };
	Canvas.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Canvas.Ptr.prototype.IsUndefined = function() { return this.Context.IsUndefined(); };
	Canvas.prototype.Length = function() { return this.go$val.Length(); };
	Canvas.Ptr.prototype.Length = function() { return this.Context.Length(); };
	Canvas.prototype.LineWidth = function(width) { return this.go$val.LineWidth(width); };
	Canvas.Ptr.prototype.LineWidth = function(width) { return this.Context.LineWidth(width); };
	Canvas.prototype.LinkProgram = function(program) { return this.go$val.LinkProgram(program); };
	Canvas.Ptr.prototype.LinkProgram = function(program) { return this.Context.LinkProgram(program); };
	Canvas.prototype.New = function(args) { return this.go$val.New(args); };
	Canvas.Ptr.prototype.New = function(args) { return this.Context.New(args); };
	Canvas.prototype.PixelStorei = function(pname, param) { return this.go$val.PixelStorei(pname, param); };
	Canvas.Ptr.prototype.PixelStorei = function(pname, param) { return this.Context.PixelStorei(pname, param); };
	Canvas.prototype.PolygonOffset = function(factor, units) { return this.go$val.PolygonOffset(factor, units); };
	Canvas.Ptr.prototype.PolygonOffset = function(factor, units) { return this.Context.PolygonOffset(factor, units); };
	Canvas.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) { return this.go$val.ReadPixels(x, y, width, height, format, typ, pixels); };
	Canvas.Ptr.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) { return this.Context.ReadPixels(x, y, width, height, format, typ, pixels); };
	Canvas.prototype.RenderbufferStorage = function(target, internalFormat, width, height) { return this.go$val.RenderbufferStorage(target, internalFormat, width, height); };
	Canvas.Ptr.prototype.RenderbufferStorage = function(target, internalFormat, width, height) { return this.Context.RenderbufferStorage(target, internalFormat, width, height); };
	Canvas.prototype.Scissor = function(x, y, width, height) { return this.go$val.Scissor(x, y, width, height); };
	Canvas.Ptr.prototype.Scissor = function(x, y, width, height) { return this.Context.Scissor(x, y, width, height); };
	Canvas.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Canvas.Ptr.prototype.Set = function(name, value) { return this.Context.Set(name, value); };
	Canvas.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Canvas.Ptr.prototype.SetIndex = function(i, value) { return this.Context.SetIndex(i, value); };
	Canvas.prototype.ShaderSource = function(shader, source) { return this.go$val.ShaderSource(shader, source); };
	Canvas.Ptr.prototype.ShaderSource = function(shader, source) { return this.Context.ShaderSource(shader, source); };
	Canvas.prototype.String = function() { return this.go$val.String(); };
	Canvas.Ptr.prototype.String = function() { return this.Context.String(); };
	Canvas.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) { return this.go$val.TexImage2D(target, level, internalFormat, format, kind, image); };
	Canvas.Ptr.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) { return this.Context.TexImage2D(target, level, internalFormat, format, kind, image); };
	Canvas.prototype.TexParameteri = function(target, pname, param) { return this.go$val.TexParameteri(target, pname, param); };
	Canvas.Ptr.prototype.TexParameteri = function(target, pname, param) { return this.Context.TexParameteri(target, pname, param); };
	Canvas.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) { return this.go$val.TexSubImage2D(target, level, xoffset, yoffset, format, typ, image); };
	Canvas.Ptr.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) { return this.Context.TexSubImage2D(target, level, xoffset, yoffset, format, typ, image); };
	Canvas.prototype.Uniform1f = function(location, x) { return this.go$val.Uniform1f(location, x); };
	Canvas.Ptr.prototype.Uniform1f = function(location, x) { return this.Context.Uniform1f(location, x); };
	Canvas.prototype.Uniform1i = function(location, x) { return this.go$val.Uniform1i(location, x); };
	Canvas.Ptr.prototype.Uniform1i = function(location, x) { return this.Context.Uniform1i(location, x); };
	Canvas.prototype.Uniform2f = function(location, x, y) { return this.go$val.Uniform2f(location, x, y); };
	Canvas.Ptr.prototype.Uniform2f = function(location, x, y) { return this.Context.Uniform2f(location, x, y); };
	Canvas.prototype.Uniform2i = function(location, x, y) { return this.go$val.Uniform2i(location, x, y); };
	Canvas.Ptr.prototype.Uniform2i = function(location, x, y) { return this.Context.Uniform2i(location, x, y); };
	Canvas.prototype.Uniform3f = function(location, x, y, z) { return this.go$val.Uniform3f(location, x, y, z); };
	Canvas.Ptr.prototype.Uniform3f = function(location, x, y, z) { return this.Context.Uniform3f(location, x, y, z); };
	Canvas.prototype.Uniform3i = function(location, x, y, z) { return this.go$val.Uniform3i(location, x, y, z); };
	Canvas.Ptr.prototype.Uniform3i = function(location, x, y, z) { return this.Context.Uniform3i(location, x, y, z); };
	Canvas.prototype.Uniform4f = function(location, x, y, z, w) { return this.go$val.Uniform4f(location, x, y, z, w); };
	Canvas.Ptr.prototype.Uniform4f = function(location, x, y, z, w) { return this.Context.Uniform4f(location, x, y, z, w); };
	Canvas.prototype.Uniform4i = function(location, x, y, z, w) { return this.go$val.Uniform4i(location, x, y, z, w); };
	Canvas.Ptr.prototype.Uniform4i = function(location, x, y, z, w) { return this.Context.Uniform4i(location, x, y, z, w); };
	Canvas.prototype.UniformMatrix2fv = function(location, transpose, value) { return this.go$val.UniformMatrix2fv(location, transpose, value); };
	Canvas.Ptr.prototype.UniformMatrix2fv = function(location, transpose, value) { return this.Context.UniformMatrix2fv(location, transpose, value); };
	Canvas.prototype.UniformMatrix3fv = function(location, transpose, value) { return this.go$val.UniformMatrix3fv(location, transpose, value); };
	Canvas.Ptr.prototype.UniformMatrix3fv = function(location, transpose, value) { return this.Context.UniformMatrix3fv(location, transpose, value); };
	Canvas.prototype.UniformMatrix4fv = function(location, transpose, value) { return this.go$val.UniformMatrix4fv(location, transpose, value); };
	Canvas.Ptr.prototype.UniformMatrix4fv = function(location, transpose, value) { return this.Context.UniformMatrix4fv(location, transpose, value); };
	Canvas.prototype.UseProgram = function(program) { return this.go$val.UseProgram(program); };
	Canvas.Ptr.prototype.UseProgram = function(program) { return this.Context.UseProgram(program); };
	Canvas.prototype.ValidateProgram = function(program) { return this.go$val.ValidateProgram(program); };
	Canvas.Ptr.prototype.ValidateProgram = function(program) { return this.Context.ValidateProgram(program); };
	Canvas.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) { return this.go$val.VertexAttribPointer(index, size, typ, normal, stride, offset); };
	Canvas.Ptr.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) { return this.Context.VertexAttribPointer(index, size, typ, normal, stride, offset); };
	Canvas.prototype.Viewport = function(x, y, width, height) { return this.go$val.Viewport(x, y, width, height); };
	Canvas.Ptr.prototype.Viewport = function(x, y, width, height) { return this.Context.Viewport(x, y, width, height); };
	go$pkg.Canvas = Canvas;
	var Responder;
	Responder = go$newType(0, "Interface", "enj.Responder", "Responder", "github.com/ajhager/enj", null);
	go$pkg.Responder = Responder;
	var Game;
	Game = go$newType(0, "Struct", "enj.Game", "Game", "github.com/ajhager/enj", function(responder_, lastTime_, lastSecond_, frames_, fps_, requestId_, Load_, Canvas_) {
		this.go$val = this;
		this.responder = responder_ !== undefined ? responder_ : null;
		this.lastTime = lastTime_ !== undefined ? lastTime_ : 0;
		this.lastSecond = lastSecond_ !== undefined ? lastSecond_ : 0;
		this.frames = frames_ !== undefined ? frames_ : 0;
		this.fps = fps_ !== undefined ? fps_ : 0;
		this.requestId = requestId_ !== undefined ? requestId_ : 0;
		this.Load = Load_ !== undefined ? Load_ : (go$ptrType(Assets)).nil;
		this.Canvas = Canvas_ !== undefined ? Canvas_ : (go$ptrType(Canvas)).nil;
	});
	Game.prototype.ActiveTexture = function(texture) { return this.go$val.ActiveTexture(texture); };
	Game.Ptr.prototype.ActiveTexture = function(texture) { return this.Canvas.ActiveTexture(texture); };
	Game.prototype.AddResource = function(r) { return this.go$val.AddResource(r); };
	Game.Ptr.prototype.AddResource = function(r) { return this.Canvas.AddResource(r); };
	Game.prototype.AttachShader = function(program, shader) { return this.go$val.AttachShader(program, shader); };
	Game.Ptr.prototype.AttachShader = function(program, shader) { return this.Canvas.AttachShader(program, shader); };
	Game.prototype.BindAttribLocation = function(program, index, name) { return this.go$val.BindAttribLocation(program, index, name); };
	Game.Ptr.prototype.BindAttribLocation = function(program, index, name) { return this.Canvas.BindAttribLocation(program, index, name); };
	Game.prototype.BindBuffer = function(target, buffer) { return this.go$val.BindBuffer(target, buffer); };
	Game.Ptr.prototype.BindBuffer = function(target, buffer) { return this.Canvas.BindBuffer(target, buffer); };
	Game.prototype.BindFramebuffer = function(target, framebuffer) { return this.go$val.BindFramebuffer(target, framebuffer); };
	Game.Ptr.prototype.BindFramebuffer = function(target, framebuffer) { return this.Canvas.BindFramebuffer(target, framebuffer); };
	Game.prototype.BindRenderbuffer = function(target, renderbuffer) { return this.go$val.BindRenderbuffer(target, renderbuffer); };
	Game.Ptr.prototype.BindRenderbuffer = function(target, renderbuffer) { return this.Canvas.BindRenderbuffer(target, renderbuffer); };
	Game.prototype.BindTexture = function(target, texture) { return this.go$val.BindTexture(target, texture); };
	Game.Ptr.prototype.BindTexture = function(target, texture) { return this.Canvas.BindTexture(target, texture); };
	Game.prototype.BlendColor = function(r, g, b, a) { return this.go$val.BlendColor(r, g, b, a); };
	Game.Ptr.prototype.BlendColor = function(r, g, b, a) { return this.Canvas.BlendColor(r, g, b, a); };
	Game.prototype.BlendEquation = function(mode) { return this.go$val.BlendEquation(mode); };
	Game.Ptr.prototype.BlendEquation = function(mode) { return this.Canvas.BlendEquation(mode); };
	Game.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) { return this.go$val.BlendEquationSeparate(modeRGB, modeAlpha); };
	Game.Ptr.prototype.BlendEquationSeparate = function(modeRGB, modeAlpha) { return this.Canvas.BlendEquationSeparate(modeRGB, modeAlpha); };
	Game.prototype.BlendFunc = function(sfactor, dfactor) { return this.go$val.BlendFunc(sfactor, dfactor); };
	Game.Ptr.prototype.BlendFunc = function(sfactor, dfactor) { return this.Canvas.BlendFunc(sfactor, dfactor); };
	Game.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) { return this.go$val.BlendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha); };
	Game.Ptr.prototype.BlendFuncSeparate = function(srcRGB, dstRGB, srcAlpha, dstAlpha) { return this.Canvas.BlendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha); };
	Game.prototype.Bool = function() { return this.go$val.Bool(); };
	Game.Ptr.prototype.Bool = function() { return this.Canvas.Bool(); };
	Game.prototype.BufferData = function(target, data, usage) { return this.go$val.BufferData(target, data, usage); };
	Game.Ptr.prototype.BufferData = function(target, data, usage) { return this.Canvas.BufferData(target, data, usage); };
	Game.prototype.BufferSubData = function(target, offset, data) { return this.go$val.BufferSubData(target, offset, data); };
	Game.Ptr.prototype.BufferSubData = function(target, offset, data) { return this.Canvas.BufferSubData(target, offset, data); };
	Game.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Game.Ptr.prototype.Call = function(name, args) { return this.Canvas.Call(name, args); };
	Game.prototype.CheckFramebufferStatus = function(target) { return this.go$val.CheckFramebufferStatus(target); };
	Game.Ptr.prototype.CheckFramebufferStatus = function(target) { return this.Canvas.CheckFramebufferStatus(target); };
	Game.prototype.Clear = function(flags) { return this.go$val.Clear(flags); };
	Game.Ptr.prototype.Clear = function(flags) { return this.Canvas.Clear(flags); };
	Game.prototype.ClearColor = function(r, g, b, a) { return this.go$val.ClearColor(r, g, b, a); };
	Game.Ptr.prototype.ClearColor = function(r, g, b, a) { return this.Canvas.ClearColor(r, g, b, a); };
	Game.prototype.ClearDepth = function(depth) { return this.go$val.ClearDepth(depth); };
	Game.Ptr.prototype.ClearDepth = function(depth) { return this.Canvas.ClearDepth(depth); };
	Game.prototype.ClearStencil = function(s) { return this.go$val.ClearStencil(s); };
	Game.Ptr.prototype.ClearStencil = function(s) { return this.Canvas.ClearStencil(s); };
	Game.prototype.ColorMask = function(r, g, b, a) { return this.go$val.ColorMask(r, g, b, a); };
	Game.Ptr.prototype.ColorMask = function(r, g, b, a) { return this.Canvas.ColorMask(r, g, b, a); };
	Game.prototype.CompileShader = function(shader) { return this.go$val.CompileShader(shader); };
	Game.Ptr.prototype.CompileShader = function(shader) { return this.Canvas.CompileShader(shader); };
	Game.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) { return this.go$val.CopyTexImage2D(target, level, internal, x, y, w, h, border); };
	Game.Ptr.prototype.CopyTexImage2D = function(target, level, internal, x, y, w, h, border) { return this.Canvas.CopyTexImage2D(target, level, internal, x, y, w, h, border); };
	Game.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) { return this.go$val.CopyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h); };
	Game.Ptr.prototype.CopyTexSubImage2D = function(target, level, xoffset, yoffset, x, y, w, h) { return this.Canvas.CopyTexSubImage2D(target, level, xoffset, yoffset, x, y, w, h); };
	Game.prototype.CreateBuffer = function() { return this.go$val.CreateBuffer(); };
	Game.Ptr.prototype.CreateBuffer = function() { return this.Canvas.CreateBuffer(); };
	Game.prototype.CreateFramebuffer = function() { return this.go$val.CreateFramebuffer(); };
	Game.Ptr.prototype.CreateFramebuffer = function() { return this.Canvas.CreateFramebuffer(); };
	Game.prototype.CreateProgram = function() { return this.go$val.CreateProgram(); };
	Game.Ptr.prototype.CreateProgram = function() { return this.Canvas.CreateProgram(); };
	Game.prototype.CreateRenderbuffer = function() { return this.go$val.CreateRenderbuffer(); };
	Game.Ptr.prototype.CreateRenderbuffer = function() { return this.Canvas.CreateRenderbuffer(); };
	Game.prototype.CreateShader = function(typ) { return this.go$val.CreateShader(typ); };
	Game.Ptr.prototype.CreateShader = function(typ) { return this.Canvas.CreateShader(typ); };
	Game.prototype.CreateTexture = function() { return this.go$val.CreateTexture(); };
	Game.Ptr.prototype.CreateTexture = function() { return this.Canvas.CreateTexture(); };
	Game.prototype.CullFace = function(mode) { return this.go$val.CullFace(mode); };
	Game.Ptr.prototype.CullFace = function(mode) { return this.Canvas.CullFace(mode); };
	Game.prototype.DeleteBuffer = function(buffer) { return this.go$val.DeleteBuffer(buffer); };
	Game.Ptr.prototype.DeleteBuffer = function(buffer) { return this.Canvas.DeleteBuffer(buffer); };
	Game.prototype.DeleteFramebuffer = function(framebuffer) { return this.go$val.DeleteFramebuffer(framebuffer); };
	Game.Ptr.prototype.DeleteFramebuffer = function(framebuffer) { return this.Canvas.DeleteFramebuffer(framebuffer); };
	Game.prototype.DeleteProgram = function(program) { return this.go$val.DeleteProgram(program); };
	Game.Ptr.prototype.DeleteProgram = function(program) { return this.Canvas.DeleteProgram(program); };
	Game.prototype.DeleteRenderbuffer = function(renderbuffer) { return this.go$val.DeleteRenderbuffer(renderbuffer); };
	Game.Ptr.prototype.DeleteRenderbuffer = function(renderbuffer) { return this.Canvas.DeleteRenderbuffer(renderbuffer); };
	Game.prototype.DeleteShader = function(shader) { return this.go$val.DeleteShader(shader); };
	Game.Ptr.prototype.DeleteShader = function(shader) { return this.Canvas.DeleteShader(shader); };
	Game.prototype.DeleteTexture = function(texture) { return this.go$val.DeleteTexture(texture); };
	Game.Ptr.prototype.DeleteTexture = function(texture) { return this.Canvas.DeleteTexture(texture); };
	Game.prototype.DepthFunc = function(fun) { return this.go$val.DepthFunc(fun); };
	Game.Ptr.prototype.DepthFunc = function(fun) { return this.Canvas.DepthFunc(fun); };
	Game.prototype.DepthMask = function(flag) { return this.go$val.DepthMask(flag); };
	Game.Ptr.prototype.DepthMask = function(flag) { return this.Canvas.DepthMask(flag); };
	Game.prototype.DepthRange = function(zNear, zFar) { return this.go$val.DepthRange(zNear, zFar); };
	Game.Ptr.prototype.DepthRange = function(zNear, zFar) { return this.Canvas.DepthRange(zNear, zFar); };
	Game.prototype.DetachShader = function(program, shader) { return this.go$val.DetachShader(program, shader); };
	Game.Ptr.prototype.DetachShader = function(program, shader) { return this.Canvas.DetachShader(program, shader); };
	Game.prototype.Disable = function(cap) { return this.go$val.Disable(cap); };
	Game.Ptr.prototype.Disable = function(cap) { return this.Canvas.Disable(cap); };
	Game.prototype.DisableVertexAttribArray = function(index) { return this.go$val.DisableVertexAttribArray(index); };
	Game.Ptr.prototype.DisableVertexAttribArray = function(index) { return this.Canvas.DisableVertexAttribArray(index); };
	Game.prototype.DrawArrays = function(mode, first, count) { return this.go$val.DrawArrays(mode, first, count); };
	Game.Ptr.prototype.DrawArrays = function(mode, first, count) { return this.Canvas.DrawArrays(mode, first, count); };
	Game.prototype.DrawElements = function(mode, count, typ, offset) { return this.go$val.DrawElements(mode, count, typ, offset); };
	Game.Ptr.prototype.DrawElements = function(mode, count, typ, offset) { return this.Canvas.DrawElements(mode, count, typ, offset); };
	Game.prototype.Enable = function(cap) { return this.go$val.Enable(cap); };
	Game.Ptr.prototype.Enable = function(cap) { return this.Canvas.Enable(cap); };
	Game.prototype.EnableVertexAttribArray = function(index) { return this.go$val.EnableVertexAttribArray(index); };
	Game.Ptr.prototype.EnableVertexAttribArray = function(index) { return this.Canvas.EnableVertexAttribArray(index); };
	Game.prototype.Finish = function() { return this.go$val.Finish(); };
	Game.Ptr.prototype.Finish = function() { return this.Canvas.Finish(); };
	Game.prototype.Float = function() { return this.go$val.Float(); };
	Game.Ptr.prototype.Float = function() { return this.Canvas.Float(); };
	Game.prototype.Flush = function() { return this.go$val.Flush(); };
	Game.Ptr.prototype.Flush = function() { return this.Canvas.Flush(); };
	Game.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) { return this.go$val.FrameBufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer); };
	Game.Ptr.prototype.FrameBufferRenderBuffer = function(target, attachment, renderbufferTarget, renderbuffer) { return this.Canvas.FrameBufferRenderBuffer(target, attachment, renderbufferTarget, renderbuffer); };
	Game.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) { return this.go$val.FramebufferTexture2D(target, attachment, textarget, texture, level); };
	Game.Ptr.prototype.FramebufferTexture2D = function(target, attachment, textarget, texture, level) { return this.Canvas.FramebufferTexture2D(target, attachment, textarget, texture, level); };
	Game.prototype.FrontFace = function(mode) { return this.go$val.FrontFace(mode); };
	Game.Ptr.prototype.FrontFace = function(mode) { return this.Canvas.FrontFace(mode); };
	Game.prototype.GenerateMipmap = function(target) { return this.go$val.GenerateMipmap(target); };
	Game.Ptr.prototype.GenerateMipmap = function(target) { return this.Canvas.GenerateMipmap(target); };
	Game.prototype.Get = function(name) { return this.go$val.Get(name); };
	Game.Ptr.prototype.Get = function(name) { return this.Canvas.Get(name); };
	Game.prototype.GetActiveAttrib = function(program, index) { return this.go$val.GetActiveAttrib(program, index); };
	Game.Ptr.prototype.GetActiveAttrib = function(program, index) { return this.Canvas.GetActiveAttrib(program, index); };
	Game.prototype.GetActiveUniform = function(program, index) { return this.go$val.GetActiveUniform(program, index); };
	Game.Ptr.prototype.GetActiveUniform = function(program, index) { return this.Canvas.GetActiveUniform(program, index); };
	Game.prototype.GetAttachedShaders = function(program) { return this.go$val.GetAttachedShaders(program); };
	Game.Ptr.prototype.GetAttachedShaders = function(program) { return this.Canvas.GetAttachedShaders(program); };
	Game.prototype.GetAttribLocation = function(program, name) { return this.go$val.GetAttribLocation(program, name); };
	Game.Ptr.prototype.GetAttribLocation = function(program, name) { return this.Canvas.GetAttribLocation(program, name); };
	Game.prototype.GetBufferParameter = function(target, pname) { return this.go$val.GetBufferParameter(target, pname); };
	Game.Ptr.prototype.GetBufferParameter = function(target, pname) { return this.Canvas.GetBufferParameter(target, pname); };
	Game.prototype.GetContextAttributes = function() { return this.go$val.GetContextAttributes(); };
	Game.Ptr.prototype.GetContextAttributes = function() { return this.Canvas.GetContextAttributes(); };
	Game.prototype.GetError = function() { return this.go$val.GetError(); };
	Game.Ptr.prototype.GetError = function() { return this.Canvas.GetError(); };
	Game.prototype.GetExtension = function(name) { return this.go$val.GetExtension(name); };
	Game.Ptr.prototype.GetExtension = function(name) { return this.Canvas.GetExtension(name); };
	Game.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) { return this.go$val.GetFramebufferAttachmentParameter(target, attachment, pname); };
	Game.Ptr.prototype.GetFramebufferAttachmentParameter = function(target, attachment, pname) { return this.Canvas.GetFramebufferAttachmentParameter(target, attachment, pname); };
	Game.prototype.GetParameter = function(pname) { return this.go$val.GetParameter(pname); };
	Game.Ptr.prototype.GetParameter = function(pname) { return this.Canvas.GetParameter(pname); };
	Game.prototype.GetProgramInfoLog = function(program) { return this.go$val.GetProgramInfoLog(program); };
	Game.Ptr.prototype.GetProgramInfoLog = function(program) { return this.Canvas.GetProgramInfoLog(program); };
	Game.prototype.GetProgramParameterb = function(program, pname) { return this.go$val.GetProgramParameterb(program, pname); };
	Game.Ptr.prototype.GetProgramParameterb = function(program, pname) { return this.Canvas.GetProgramParameterb(program, pname); };
	Game.prototype.GetProgramParameteri = function(program, pname) { return this.go$val.GetProgramParameteri(program, pname); };
	Game.Ptr.prototype.GetProgramParameteri = function(program, pname) { return this.Canvas.GetProgramParameteri(program, pname); };
	Game.prototype.GetRenderbufferParameter = function(target, pname) { return this.go$val.GetRenderbufferParameter(target, pname); };
	Game.Ptr.prototype.GetRenderbufferParameter = function(target, pname) { return this.Canvas.GetRenderbufferParameter(target, pname); };
	Game.prototype.GetShaderInfoLog = function(shader) { return this.go$val.GetShaderInfoLog(shader); };
	Game.Ptr.prototype.GetShaderInfoLog = function(shader) { return this.Canvas.GetShaderInfoLog(shader); };
	Game.prototype.GetShaderParameter = function(shader, pname) { return this.go$val.GetShaderParameter(shader, pname); };
	Game.Ptr.prototype.GetShaderParameter = function(shader, pname) { return this.Canvas.GetShaderParameter(shader, pname); };
	Game.prototype.GetShaderParameterb = function(shader, pname) { return this.go$val.GetShaderParameterb(shader, pname); };
	Game.Ptr.prototype.GetShaderParameterb = function(shader, pname) { return this.Canvas.GetShaderParameterb(shader, pname); };
	Game.prototype.GetShaderSource = function(shader) { return this.go$val.GetShaderSource(shader); };
	Game.Ptr.prototype.GetShaderSource = function(shader) { return this.Canvas.GetShaderSource(shader); };
	Game.prototype.GetSupportedExtensions = function() { return this.go$val.GetSupportedExtensions(); };
	Game.Ptr.prototype.GetSupportedExtensions = function() { return this.Canvas.GetSupportedExtensions(); };
	Game.prototype.GetTexParameter = function(target, pname) { return this.go$val.GetTexParameter(target, pname); };
	Game.Ptr.prototype.GetTexParameter = function(target, pname) { return this.Canvas.GetTexParameter(target, pname); };
	Game.prototype.GetUniform = function(program, location) { return this.go$val.GetUniform(program, location); };
	Game.Ptr.prototype.GetUniform = function(program, location) { return this.Canvas.GetUniform(program, location); };
	Game.prototype.GetUniformLocation = function(program, name) { return this.go$val.GetUniformLocation(program, name); };
	Game.Ptr.prototype.GetUniformLocation = function(program, name) { return this.Canvas.GetUniformLocation(program, name); };
	Game.prototype.GetVertexAttrib = function(index, pname) { return this.go$val.GetVertexAttrib(index, pname); };
	Game.Ptr.prototype.GetVertexAttrib = function(index, pname) { return this.Canvas.GetVertexAttrib(index, pname); };
	Game.prototype.GetVertexAttribOffset = function(index, pname) { return this.go$val.GetVertexAttribOffset(index, pname); };
	Game.Ptr.prototype.GetVertexAttribOffset = function(index, pname) { return this.Canvas.GetVertexAttribOffset(index, pname); };
	Game.prototype.Height = function() { return this.go$val.Height(); };
	Game.Ptr.prototype.Height = function() { return this.Canvas.Height(); };
	Game.prototype.Index = function(i) { return this.go$val.Index(i); };
	Game.Ptr.prototype.Index = function(i) { return this.Canvas.Index(i); };
	Game.prototype.Int = function() { return this.go$val.Int(); };
	Game.Ptr.prototype.Int = function() { return this.Canvas.Int(); };
	Game.prototype.Interface = function() { return this.go$val.Interface(); };
	Game.Ptr.prototype.Interface = function() { return this.Canvas.Interface(); };
	Game.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Game.Ptr.prototype.Invoke = function(args) { return this.Canvas.Invoke(args); };
	Game.prototype.IsBuffer = function(buffer) { return this.go$val.IsBuffer(buffer); };
	Game.Ptr.prototype.IsBuffer = function(buffer) { return this.Canvas.IsBuffer(buffer); };
	Game.prototype.IsContextLost = function() { return this.go$val.IsContextLost(); };
	Game.Ptr.prototype.IsContextLost = function() { return this.Canvas.IsContextLost(); };
	Game.prototype.IsEnabled = function(capability) { return this.go$val.IsEnabled(capability); };
	Game.Ptr.prototype.IsEnabled = function(capability) { return this.Canvas.IsEnabled(capability); };
	Game.prototype.IsFramebuffer = function(framebuffer) { return this.go$val.IsFramebuffer(framebuffer); };
	Game.Ptr.prototype.IsFramebuffer = function(framebuffer) { return this.Canvas.IsFramebuffer(framebuffer); };
	Game.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Game.Ptr.prototype.IsNull = function() { return this.Canvas.IsNull(); };
	Game.prototype.IsProgram = function(program) { return this.go$val.IsProgram(program); };
	Game.Ptr.prototype.IsProgram = function(program) { return this.Canvas.IsProgram(program); };
	Game.prototype.IsRenderbuffer = function(renderbuffer) { return this.go$val.IsRenderbuffer(renderbuffer); };
	Game.Ptr.prototype.IsRenderbuffer = function(renderbuffer) { return this.Canvas.IsRenderbuffer(renderbuffer); };
	Game.prototype.IsShader = function(shader) { return this.go$val.IsShader(shader); };
	Game.Ptr.prototype.IsShader = function(shader) { return this.Canvas.IsShader(shader); };
	Game.prototype.IsTexture = function(texture) { return this.go$val.IsTexture(texture); };
	Game.Ptr.prototype.IsTexture = function(texture) { return this.Canvas.IsTexture(texture); };
	Game.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Game.Ptr.prototype.IsUndefined = function() { return this.Canvas.IsUndefined(); };
	Game.prototype.Length = function() { return this.go$val.Length(); };
	Game.Ptr.prototype.Length = function() { return this.Canvas.Length(); };
	Game.prototype.LineWidth = function(width) { return this.go$val.LineWidth(width); };
	Game.Ptr.prototype.LineWidth = function(width) { return this.Canvas.LineWidth(width); };
	Game.prototype.LinkProgram = function(program) { return this.go$val.LinkProgram(program); };
	Game.Ptr.prototype.LinkProgram = function(program) { return this.Canvas.LinkProgram(program); };
	Game.prototype.New = function(args) { return this.go$val.New(args); };
	Game.Ptr.prototype.New = function(args) { return this.Canvas.New(args); };
	Game.prototype.OnLoss = function(handler) { return this.go$val.OnLoss(handler); };
	Game.Ptr.prototype.OnLoss = function(handler) { return this.Canvas.OnLoss(handler); };
	Game.prototype.OnRestored = function(handler) { return this.go$val.OnRestored(handler); };
	Game.Ptr.prototype.OnRestored = function(handler) { return this.Canvas.OnRestored(handler); };
	Game.prototype.PixelRatio = function() { return this.go$val.PixelRatio(); };
	Game.Ptr.prototype.PixelRatio = function() { return this.Canvas.PixelRatio(); };
	Game.prototype.PixelStorei = function(pname, param) { return this.go$val.PixelStorei(pname, param); };
	Game.Ptr.prototype.PixelStorei = function(pname, param) { return this.Canvas.PixelStorei(pname, param); };
	Game.prototype.PolygonOffset = function(factor, units) { return this.go$val.PolygonOffset(factor, units); };
	Game.Ptr.prototype.PolygonOffset = function(factor, units) { return this.Canvas.PolygonOffset(factor, units); };
	Game.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) { return this.go$val.ReadPixels(x, y, width, height, format, typ, pixels); };
	Game.Ptr.prototype.ReadPixels = function(x, y, width, height, format, typ, pixels) { return this.Canvas.ReadPixels(x, y, width, height, format, typ, pixels); };
	Game.prototype.RenderbufferStorage = function(target, internalFormat, width, height) { return this.go$val.RenderbufferStorage(target, internalFormat, width, height); };
	Game.Ptr.prototype.RenderbufferStorage = function(target, internalFormat, width, height) { return this.Canvas.RenderbufferStorage(target, internalFormat, width, height); };
	Game.prototype.Resize = function(width, height, fullscreen) { return this.go$val.Resize(width, height, fullscreen); };
	Game.Ptr.prototype.Resize = function(width, height, fullscreen) { return this.Canvas.Resize(width, height, fullscreen); };
	Game.prototype.Scissor = function(x, y, width, height) { return this.go$val.Scissor(x, y, width, height); };
	Game.Ptr.prototype.Scissor = function(x, y, width, height) { return this.Canvas.Scissor(x, y, width, height); };
	Game.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Game.Ptr.prototype.Set = function(name, value) { return this.Canvas.Set(name, value); };
	Game.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Game.Ptr.prototype.SetIndex = function(i, value) { return this.Canvas.SetIndex(i, value); };
	Game.prototype.ShaderSource = function(shader, source) { return this.go$val.ShaderSource(shader, source); };
	Game.Ptr.prototype.ShaderSource = function(shader, source) { return this.Canvas.ShaderSource(shader, source); };
	Game.prototype.String = function() { return this.go$val.String(); };
	Game.Ptr.prototype.String = function() { return this.Canvas.String(); };
	Game.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) { return this.go$val.TexImage2D(target, level, internalFormat, format, kind, image); };
	Game.Ptr.prototype.TexImage2D = function(target, level, internalFormat, format, kind, image) { return this.Canvas.TexImage2D(target, level, internalFormat, format, kind, image); };
	Game.prototype.TexParameteri = function(target, pname, param) { return this.go$val.TexParameteri(target, pname, param); };
	Game.Ptr.prototype.TexParameteri = function(target, pname, param) { return this.Canvas.TexParameteri(target, pname, param); };
	Game.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) { return this.go$val.TexSubImage2D(target, level, xoffset, yoffset, format, typ, image); };
	Game.Ptr.prototype.TexSubImage2D = function(target, level, xoffset, yoffset, format, typ, image) { return this.Canvas.TexSubImage2D(target, level, xoffset, yoffset, format, typ, image); };
	Game.prototype.Uniform1f = function(location, x) { return this.go$val.Uniform1f(location, x); };
	Game.Ptr.prototype.Uniform1f = function(location, x) { return this.Canvas.Uniform1f(location, x); };
	Game.prototype.Uniform1i = function(location, x) { return this.go$val.Uniform1i(location, x); };
	Game.Ptr.prototype.Uniform1i = function(location, x) { return this.Canvas.Uniform1i(location, x); };
	Game.prototype.Uniform2f = function(location, x, y) { return this.go$val.Uniform2f(location, x, y); };
	Game.Ptr.prototype.Uniform2f = function(location, x, y) { return this.Canvas.Uniform2f(location, x, y); };
	Game.prototype.Uniform2i = function(location, x, y) { return this.go$val.Uniform2i(location, x, y); };
	Game.Ptr.prototype.Uniform2i = function(location, x, y) { return this.Canvas.Uniform2i(location, x, y); };
	Game.prototype.Uniform3f = function(location, x, y, z) { return this.go$val.Uniform3f(location, x, y, z); };
	Game.Ptr.prototype.Uniform3f = function(location, x, y, z) { return this.Canvas.Uniform3f(location, x, y, z); };
	Game.prototype.Uniform3i = function(location, x, y, z) { return this.go$val.Uniform3i(location, x, y, z); };
	Game.Ptr.prototype.Uniform3i = function(location, x, y, z) { return this.Canvas.Uniform3i(location, x, y, z); };
	Game.prototype.Uniform4f = function(location, x, y, z, w) { return this.go$val.Uniform4f(location, x, y, z, w); };
	Game.Ptr.prototype.Uniform4f = function(location, x, y, z, w) { return this.Canvas.Uniform4f(location, x, y, z, w); };
	Game.prototype.Uniform4i = function(location, x, y, z, w) { return this.go$val.Uniform4i(location, x, y, z, w); };
	Game.Ptr.prototype.Uniform4i = function(location, x, y, z, w) { return this.Canvas.Uniform4i(location, x, y, z, w); };
	Game.prototype.UniformMatrix2fv = function(location, transpose, value) { return this.go$val.UniformMatrix2fv(location, transpose, value); };
	Game.Ptr.prototype.UniformMatrix2fv = function(location, transpose, value) { return this.Canvas.UniformMatrix2fv(location, transpose, value); };
	Game.prototype.UniformMatrix3fv = function(location, transpose, value) { return this.go$val.UniformMatrix3fv(location, transpose, value); };
	Game.Ptr.prototype.UniformMatrix3fv = function(location, transpose, value) { return this.Canvas.UniformMatrix3fv(location, transpose, value); };
	Game.prototype.UniformMatrix4fv = function(location, transpose, value) { return this.go$val.UniformMatrix4fv(location, transpose, value); };
	Game.Ptr.prototype.UniformMatrix4fv = function(location, transpose, value) { return this.Canvas.UniformMatrix4fv(location, transpose, value); };
	Game.prototype.UseProgram = function(program) { return this.go$val.UseProgram(program); };
	Game.Ptr.prototype.UseProgram = function(program) { return this.Canvas.UseProgram(program); };
	Game.prototype.ValidateProgram = function(program) { return this.go$val.ValidateProgram(program); };
	Game.Ptr.prototype.ValidateProgram = function(program) { return this.Canvas.ValidateProgram(program); };
	Game.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) { return this.go$val.VertexAttribPointer(index, size, typ, normal, stride, offset); };
	Game.Ptr.prototype.VertexAttribPointer = function(index, size, typ, normal, stride, offset) { return this.Canvas.VertexAttribPointer(index, size, typ, normal, stride, offset); };
	Game.prototype.Viewport = function(x, y, width, height) { return this.go$val.Viewport(x, y, width, height); };
	Game.Ptr.prototype.Viewport = function(x, y, width, height) { return this.Canvas.Viewport(x, y, width, height); };
	Game.prototype.Width = function() { return this.go$val.Width(); };
	Game.Ptr.prototype.Width = function() { return this.Canvas.Width(); };
	go$pkg.Game = Game;
	var Shader;
	Shader = go$newType(0, "Struct", "enj.Shader", "Shader", "github.com/ajhager/enj", function(Object_, gl_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.gl = gl_ !== undefined ? gl_ : (go$ptrType(Canvas)).nil;
	});
	Shader.prototype.Bool = function() { return this.go$val.Bool(); };
	Shader.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Shader.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Shader.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Shader.prototype.Float = function() { return this.go$val.Float(); };
	Shader.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Shader.prototype.Get = function(name) { return this.go$val.Get(name); };
	Shader.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Shader.prototype.Index = function(i) { return this.go$val.Index(i); };
	Shader.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Shader.prototype.Int = function() { return this.go$val.Int(); };
	Shader.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Shader.prototype.Interface = function() { return this.go$val.Interface(); };
	Shader.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Shader.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Shader.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Shader.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Shader.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Shader.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Shader.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Shader.prototype.Length = function() { return this.go$val.Length(); };
	Shader.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Shader.prototype.New = function(args) { return this.go$val.New(args); };
	Shader.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Shader.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Shader.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Shader.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Shader.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Shader.prototype.String = function() { return this.go$val.String(); };
	Shader.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Shader = Shader;
	var Region;
	Region = go$newType(0, "Struct", "enj.Region", "Region", "github.com/ajhager/enj", function(texture_, u_, v_, u2_, v2_, width_, height_) {
		this.go$val = this;
		this.texture = texture_ !== undefined ? texture_ : (go$ptrType(Texture)).nil;
		this.u = u_ !== undefined ? u_ : 0;
		this.v = v_ !== undefined ? v_ : 0;
		this.u2 = u2_ !== undefined ? u2_ : 0;
		this.v2 = v2_ !== undefined ? v2_ : 0;
		this.width = width_ !== undefined ? width_ : 0;
		this.height = height_ !== undefined ? height_ : 0;
	});
	go$pkg.Region = Region;
	var Texture;
	Texture = go$newType(0, "Struct", "enj.Texture", "Texture", "github.com/ajhager/enj", function(gl_, tex_, img_, minFilter_, maxFilter_, uWrap_, vWrap_, mipmaps_) {
		this.go$val = this;
		this.gl = gl_ !== undefined ? gl_ : (go$ptrType(Canvas)).nil;
		this.tex = tex_ !== undefined ? tex_ : null;
		this.img = img_ !== undefined ? img_ : null;
		this.minFilter = minFilter_ !== undefined ? minFilter_ : 0;
		this.maxFilter = maxFilter_ !== undefined ? maxFilter_ : 0;
		this.uWrap = uWrap_ !== undefined ? uWrap_ : 0;
		this.vWrap = vWrap_ !== undefined ? vWrap_ : 0;
		this.mipmaps = mipmaps_ !== undefined ? mipmaps_ : false;
	});
	go$pkg.Texture = Texture;
	Assets.init([["queue", "github.com/ajhager/enj", (go$sliceType(Go$String)), ""], ["cache", "github.com/ajhager/enj", (go$mapType(Go$String, js.Object)), ""], ["loads", "github.com/ajhager/enj", Go$Int, ""], ["errors", "github.com/ajhager/enj", Go$Int, ""]]);
	(go$ptrType(Assets)).methods = [["Image", "", [Go$String], [], false], ["Load", "", [(go$funcType([], [], false))], [], false]];
	Batch.init([["gl", "github.com/ajhager/enj", (go$ptrType(Canvas)), ""], ["drawing", "github.com/ajhager/enj", Go$Bool, ""], ["lastTexture", "github.com/ajhager/enj", (go$ptrType(Texture)), ""], ["color", "github.com/ajhager/enj", Go$Float32, ""], ["vertices", "github.com/ajhager/enj", js.Object, ""], ["vertexVBO", "github.com/ajhager/enj", js.Object, ""], ["indices", "github.com/ajhager/enj", js.Object, ""], ["indexVBO", "github.com/ajhager/enj", js.Object, ""], ["index", "github.com/ajhager/enj", Go$Int, ""], ["shader", "github.com/ajhager/enj", (go$ptrType(Shader)), ""], ["customShader", "github.com/ajhager/enj", (go$ptrType(Shader)), ""], ["blendingDisabled", "github.com/ajhager/enj", Go$Bool, ""], ["blendSrcFunc", "github.com/ajhager/enj", Go$Int, ""], ["blendDstFunc", "github.com/ajhager/enj", Go$Int, ""], ["inPosition", "github.com/ajhager/enj", Go$Int, ""], ["inColor", "github.com/ajhager/enj", Go$Int, ""], ["inTexCoords", "github.com/ajhager/enj", Go$Int, ""], ["ufProjection", "github.com/ajhager/enj", js.Object, ""], ["projX", "github.com/ajhager/enj", Go$Float32, ""], ["projY", "github.com/ajhager/enj", Go$Float32, ""]]);
	(go$ptrType(Batch)).methods = [["Begin", "", [], [], false], ["Draw", "", [(go$ptrType(Region)), Go$Float32, Go$Float32, Go$Float32, Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["End", "", [], [], false], ["SetColor", "", [Go$Uint8, Go$Uint8, Go$Uint8, Go$Uint8], [], false], ["flush", "github.com/ajhager/enj", [], [], false]];
	Managed.init([["Create", "", (go$funcType([], [], false))]]);
	Canvas.init([["", "", js.Object, ""], ["", "", (go$ptrType(webgl.Context)), ""], ["attrs", "github.com/ajhager/enj", (go$ptrType(webgl.ContextAttributes)), ""], ["width", "github.com/ajhager/enj", Go$Int, ""], ["height", "github.com/ajhager/enj", Go$Int, ""], ["pixelRatio", "github.com/ajhager/enj", Go$Int, ""], ["fullscreen", "github.com/ajhager/enj", Go$Bool, ""], ["resources", "github.com/ajhager/enj", (go$sliceType(Managed)), ""]]);
	Canvas.methods = [["ActiveTexture", "", [Go$Int], [], false], ["AttachShader", "", [js.Object, js.Object], [], false], ["BindAttribLocation", "", [js.Object, Go$Int, Go$String], [], false], ["BindBuffer", "", [Go$Int, js.Object], [], false], ["BindFramebuffer", "", [Go$Int, js.Object], [], false], ["BindRenderbuffer", "", [Go$Int, js.Object], [], false], ["BindTexture", "", [Go$Int, js.Object], [], false], ["BlendColor", "", [Go$Float64, Go$Float64, Go$Float64, Go$Float64], [], false], ["BlendEquation", "", [Go$Int], [], false], ["BlendEquationSeparate", "", [Go$Int, Go$Int], [], false], ["BlendFunc", "", [Go$Int, Go$Int], [], false], ["BlendFuncSeparate", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Bool", "", [], [Go$Bool], false], ["BufferData", "", [Go$Int, js.Object, Go$Int], [], false], ["BufferSubData", "", [Go$Int, Go$Int, js.Object], [], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["CheckFramebufferStatus", "", [Go$Int], [Go$Int], false], ["Clear", "", [Go$Int], [], false], ["ClearColor", "", [Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["ClearDepth", "", [Go$Float64], [], false], ["ClearStencil", "", [Go$Int], [], false], ["ColorMask", "", [Go$Bool, Go$Bool, Go$Bool, Go$Bool], [], false], ["CompileShader", "", [js.Object], [], false], ["CopyTexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CopyTexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CreateBuffer", "", [], [js.Object], false], ["CreateFramebuffer", "", [], [js.Object], false], ["CreateProgram", "", [], [js.Object], false], ["CreateRenderbuffer", "", [], [js.Object], false], ["CreateShader", "", [Go$Int], [js.Object], false], ["CreateTexture", "", [], [js.Object], false], ["CullFace", "", [Go$Int], [], false], ["DeleteBuffer", "", [js.Object], [], false], ["DeleteFramebuffer", "", [js.Object], [], false], ["DeleteProgram", "", [js.Object], [], false], ["DeleteRenderbuffer", "", [js.Object], [], false], ["DeleteShader", "", [js.Object], [], false], ["DeleteTexture", "", [js.Object], [], false], ["DepthFunc", "", [Go$Int], [], false], ["DepthMask", "", [Go$Bool], [], false], ["DepthRange", "", [Go$Float64, Go$Float64], [], false], ["DetachShader", "", [js.Object, js.Object], [], false], ["Disable", "", [Go$Int], [], false], ["DisableVertexAttribArray", "", [Go$Int], [], false], ["DrawArrays", "", [Go$Int, Go$Int, Go$Int], [], false], ["DrawElements", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Enable", "", [Go$Int], [], false], ["EnableVertexAttribArray", "", [Go$Int], [], false], ["Finish", "", [], [], false], ["Float", "", [], [Go$Float64], false], ["Flush", "", [], [], false], ["FrameBufferRenderBuffer", "", [Go$Int, Go$Int, Go$Int, js.Object], [], false], ["FramebufferTexture2D", "", [Go$Int, Go$Int, Go$Int, js.Object, Go$Int], [], false], ["FrontFace", "", [Go$Int], [], false], ["GenerateMipmap", "", [Go$Int], [], false], ["Get", "", [Go$String], [js.Object], false], ["GetActiveAttrib", "", [js.Object, Go$Int], [js.Object], false], ["GetActiveUniform", "", [js.Object, Go$Int], [js.Object], false], ["GetAttachedShaders", "", [js.Object], [(go$sliceType(js.Object))], false], ["GetAttribLocation", "", [js.Object, Go$String], [Go$Int], false], ["GetBufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetContextAttributes", "", [], [webgl.ContextAttributes], false], ["GetError", "", [], [Go$Int], false], ["GetExtension", "", [Go$String], [js.Object], false], ["GetFramebufferAttachmentParameter", "", [Go$Int, Go$Int, Go$Int], [js.Object], false], ["GetParameter", "", [Go$Int], [js.Object], false], ["GetProgramInfoLog", "", [js.Object], [Go$String], false], ["GetProgramParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetProgramParameteri", "", [js.Object, Go$Int], [Go$Int], false], ["GetRenderbufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetShaderInfoLog", "", [js.Object], [Go$String], false], ["GetShaderParameter", "", [js.Object, Go$Int], [js.Object], false], ["GetShaderParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetShaderSource", "", [js.Object], [Go$String], false], ["GetSupportedExtensions", "", [], [(go$sliceType(Go$String))], false], ["GetTexParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetUniform", "", [js.Object, js.Object], [js.Object], false], ["GetUniformLocation", "", [js.Object, Go$String], [js.Object], false], ["GetVertexAttrib", "", [Go$Int, Go$Int], [js.Object], false], ["GetVertexAttribOffset", "", [Go$Int, Go$Int], [Go$Int], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsBuffer", "", [js.Object], [Go$Bool], false], ["IsContextLost", "", [], [Go$Bool], false], ["IsEnabled", "", [Go$Int], [Go$Bool], false], ["IsFramebuffer", "", [js.Object], [Go$Bool], false], ["IsNull", "", [], [Go$Bool], false], ["IsProgram", "", [js.Object], [Go$Bool], false], ["IsRenderbuffer", "", [js.Object], [Go$Bool], false], ["IsShader", "", [js.Object], [Go$Bool], false], ["IsTexture", "", [js.Object], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["LineWidth", "", [Go$Float64], [], false], ["LinkProgram", "", [js.Object], [], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["PixelStorei", "", [Go$Int, Go$Int], [], false], ["PolygonOffset", "", [Go$Float64, Go$Float64], [], false], ["ReadPixels", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["RenderbufferStorage", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Scissor", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["ShaderSource", "", [js.Object, Go$String], [], false], ["String", "", [], [Go$String], false], ["TexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["TexParameteri", "", [Go$Int, Go$Int, Go$Int], [], false], ["TexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["Uniform1f", "", [js.Object, Go$Float32], [], false], ["Uniform1i", "", [js.Object, Go$Int], [], false], ["Uniform2f", "", [js.Object, Go$Float32, Go$Float32], [], false], ["Uniform2i", "", [js.Object, Go$Int, Go$Int], [], false], ["Uniform3f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform3i", "", [js.Object, Go$Int, Go$Int, Go$Int], [], false], ["Uniform4f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform4i", "", [js.Object, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["UniformMatrix2fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix3fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix4fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UseProgram", "", [js.Object], [], false], ["ValidateProgram", "", [js.Object], [], false], ["VertexAttribPointer", "", [Go$Int, Go$Int, Go$Int, Go$Bool, Go$Int, Go$Int], [], false], ["Viewport", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false]];
	(go$ptrType(Canvas)).methods = [["ActiveTexture", "", [Go$Int], [], false], ["AddResource", "", [Managed], [], false], ["AttachShader", "", [js.Object, js.Object], [], false], ["BindAttribLocation", "", [js.Object, Go$Int, Go$String], [], false], ["BindBuffer", "", [Go$Int, js.Object], [], false], ["BindFramebuffer", "", [Go$Int, js.Object], [], false], ["BindRenderbuffer", "", [Go$Int, js.Object], [], false], ["BindTexture", "", [Go$Int, js.Object], [], false], ["BlendColor", "", [Go$Float64, Go$Float64, Go$Float64, Go$Float64], [], false], ["BlendEquation", "", [Go$Int], [], false], ["BlendEquationSeparate", "", [Go$Int, Go$Int], [], false], ["BlendFunc", "", [Go$Int, Go$Int], [], false], ["BlendFuncSeparate", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Bool", "", [], [Go$Bool], false], ["BufferData", "", [Go$Int, js.Object, Go$Int], [], false], ["BufferSubData", "", [Go$Int, Go$Int, js.Object], [], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["CheckFramebufferStatus", "", [Go$Int], [Go$Int], false], ["Clear", "", [Go$Int], [], false], ["ClearColor", "", [Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["ClearDepth", "", [Go$Float64], [], false], ["ClearStencil", "", [Go$Int], [], false], ["ColorMask", "", [Go$Bool, Go$Bool, Go$Bool, Go$Bool], [], false], ["CompileShader", "", [js.Object], [], false], ["CopyTexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CopyTexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CreateBuffer", "", [], [js.Object], false], ["CreateFramebuffer", "", [], [js.Object], false], ["CreateProgram", "", [], [js.Object], false], ["CreateRenderbuffer", "", [], [js.Object], false], ["CreateShader", "", [Go$Int], [js.Object], false], ["CreateTexture", "", [], [js.Object], false], ["CullFace", "", [Go$Int], [], false], ["DeleteBuffer", "", [js.Object], [], false], ["DeleteFramebuffer", "", [js.Object], [], false], ["DeleteProgram", "", [js.Object], [], false], ["DeleteRenderbuffer", "", [js.Object], [], false], ["DeleteShader", "", [js.Object], [], false], ["DeleteTexture", "", [js.Object], [], false], ["DepthFunc", "", [Go$Int], [], false], ["DepthMask", "", [Go$Bool], [], false], ["DepthRange", "", [Go$Float64, Go$Float64], [], false], ["DetachShader", "", [js.Object, js.Object], [], false], ["Disable", "", [Go$Int], [], false], ["DisableVertexAttribArray", "", [Go$Int], [], false], ["DrawArrays", "", [Go$Int, Go$Int, Go$Int], [], false], ["DrawElements", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Enable", "", [Go$Int], [], false], ["EnableVertexAttribArray", "", [Go$Int], [], false], ["Finish", "", [], [], false], ["Float", "", [], [Go$Float64], false], ["Flush", "", [], [], false], ["FrameBufferRenderBuffer", "", [Go$Int, Go$Int, Go$Int, js.Object], [], false], ["FramebufferTexture2D", "", [Go$Int, Go$Int, Go$Int, js.Object, Go$Int], [], false], ["FrontFace", "", [Go$Int], [], false], ["GenerateMipmap", "", [Go$Int], [], false], ["Get", "", [Go$String], [js.Object], false], ["GetActiveAttrib", "", [js.Object, Go$Int], [js.Object], false], ["GetActiveUniform", "", [js.Object, Go$Int], [js.Object], false], ["GetAttachedShaders", "", [js.Object], [(go$sliceType(js.Object))], false], ["GetAttribLocation", "", [js.Object, Go$String], [Go$Int], false], ["GetBufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetContextAttributes", "", [], [webgl.ContextAttributes], false], ["GetError", "", [], [Go$Int], false], ["GetExtension", "", [Go$String], [js.Object], false], ["GetFramebufferAttachmentParameter", "", [Go$Int, Go$Int, Go$Int], [js.Object], false], ["GetParameter", "", [Go$Int], [js.Object], false], ["GetProgramInfoLog", "", [js.Object], [Go$String], false], ["GetProgramParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetProgramParameteri", "", [js.Object, Go$Int], [Go$Int], false], ["GetRenderbufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetShaderInfoLog", "", [js.Object], [Go$String], false], ["GetShaderParameter", "", [js.Object, Go$Int], [js.Object], false], ["GetShaderParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetShaderSource", "", [js.Object], [Go$String], false], ["GetSupportedExtensions", "", [], [(go$sliceType(Go$String))], false], ["GetTexParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetUniform", "", [js.Object, js.Object], [js.Object], false], ["GetUniformLocation", "", [js.Object, Go$String], [js.Object], false], ["GetVertexAttrib", "", [Go$Int, Go$Int], [js.Object], false], ["GetVertexAttribOffset", "", [Go$Int, Go$Int], [Go$Int], false], ["Height", "", [], [Go$Float32], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsBuffer", "", [js.Object], [Go$Bool], false], ["IsContextLost", "", [], [Go$Bool], false], ["IsEnabled", "", [Go$Int], [Go$Bool], false], ["IsFramebuffer", "", [js.Object], [Go$Bool], false], ["IsNull", "", [], [Go$Bool], false], ["IsProgram", "", [js.Object], [Go$Bool], false], ["IsRenderbuffer", "", [js.Object], [Go$Bool], false], ["IsShader", "", [js.Object], [Go$Bool], false], ["IsTexture", "", [js.Object], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["LineWidth", "", [Go$Float64], [], false], ["LinkProgram", "", [js.Object], [], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["OnLoss", "", [(go$funcType([], [], false))], [], false], ["OnRestored", "", [(go$funcType([], [], false))], [], false], ["PixelRatio", "", [], [Go$Int], false], ["PixelStorei", "", [Go$Int, Go$Int], [], false], ["PolygonOffset", "", [Go$Float64, Go$Float64], [], false], ["ReadPixels", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["RenderbufferStorage", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Resize", "", [Go$Int, Go$Int, Go$Bool], [], false], ["Scissor", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["ShaderSource", "", [js.Object, Go$String], [], false], ["String", "", [], [Go$String], false], ["TexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["TexParameteri", "", [Go$Int, Go$Int, Go$Int], [], false], ["TexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["Uniform1f", "", [js.Object, Go$Float32], [], false], ["Uniform1i", "", [js.Object, Go$Int], [], false], ["Uniform2f", "", [js.Object, Go$Float32, Go$Float32], [], false], ["Uniform2i", "", [js.Object, Go$Int, Go$Int], [], false], ["Uniform3f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform3i", "", [js.Object, Go$Int, Go$Int, Go$Int], [], false], ["Uniform4f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform4i", "", [js.Object, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["UniformMatrix2fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix3fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix4fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UseProgram", "", [js.Object], [], false], ["ValidateProgram", "", [js.Object], [], false], ["VertexAttribPointer", "", [Go$Int, Go$Int, Go$Int, Go$Bool, Go$Int, Go$Int], [], false], ["Viewport", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Width", "", [], [Go$Float32], false]];
	Responder.init([["Draw", "", (go$funcType([], [], false))], ["Key", "", (go$funcType([Go$Int, Go$Int], [], false))], ["Load", "", (go$funcType([], [], false))], ["Mouse", "", (go$funcType([Go$Float32, Go$Float32, Go$Int], [], false))], ["Setup", "", (go$funcType([], [], false))], ["Update", "", (go$funcType([Go$Float32], [], false))]]);
	Game.init([["responder", "github.com/ajhager/enj", Responder, ""], ["lastTime", "github.com/ajhager/enj", Go$Float32, ""], ["lastSecond", "github.com/ajhager/enj", Go$Float32, ""], ["frames", "github.com/ajhager/enj", Go$Float32, ""], ["fps", "github.com/ajhager/enj", Go$Float32, ""], ["requestId", "github.com/ajhager/enj", Go$Int, ""], ["Load", "", (go$ptrType(Assets)), ""], ["", "", (go$ptrType(Canvas)), ""]]);
	Game.methods = [["ActiveTexture", "", [Go$Int], [], false], ["AddResource", "", [Managed], [], false], ["AttachShader", "", [js.Object, js.Object], [], false], ["BindAttribLocation", "", [js.Object, Go$Int, Go$String], [], false], ["BindBuffer", "", [Go$Int, js.Object], [], false], ["BindFramebuffer", "", [Go$Int, js.Object], [], false], ["BindRenderbuffer", "", [Go$Int, js.Object], [], false], ["BindTexture", "", [Go$Int, js.Object], [], false], ["BlendColor", "", [Go$Float64, Go$Float64, Go$Float64, Go$Float64], [], false], ["BlendEquation", "", [Go$Int], [], false], ["BlendEquationSeparate", "", [Go$Int, Go$Int], [], false], ["BlendFunc", "", [Go$Int, Go$Int], [], false], ["BlendFuncSeparate", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Bool", "", [], [Go$Bool], false], ["BufferData", "", [Go$Int, js.Object, Go$Int], [], false], ["BufferSubData", "", [Go$Int, Go$Int, js.Object], [], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["CheckFramebufferStatus", "", [Go$Int], [Go$Int], false], ["Clear", "", [Go$Int], [], false], ["ClearColor", "", [Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["ClearDepth", "", [Go$Float64], [], false], ["ClearStencil", "", [Go$Int], [], false], ["ColorMask", "", [Go$Bool, Go$Bool, Go$Bool, Go$Bool], [], false], ["CompileShader", "", [js.Object], [], false], ["CopyTexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CopyTexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CreateBuffer", "", [], [js.Object], false], ["CreateFramebuffer", "", [], [js.Object], false], ["CreateProgram", "", [], [js.Object], false], ["CreateRenderbuffer", "", [], [js.Object], false], ["CreateShader", "", [Go$Int], [js.Object], false], ["CreateTexture", "", [], [js.Object], false], ["CullFace", "", [Go$Int], [], false], ["DeleteBuffer", "", [js.Object], [], false], ["DeleteFramebuffer", "", [js.Object], [], false], ["DeleteProgram", "", [js.Object], [], false], ["DeleteRenderbuffer", "", [js.Object], [], false], ["DeleteShader", "", [js.Object], [], false], ["DeleteTexture", "", [js.Object], [], false], ["DepthFunc", "", [Go$Int], [], false], ["DepthMask", "", [Go$Bool], [], false], ["DepthRange", "", [Go$Float64, Go$Float64], [], false], ["DetachShader", "", [js.Object, js.Object], [], false], ["Disable", "", [Go$Int], [], false], ["DisableVertexAttribArray", "", [Go$Int], [], false], ["DrawArrays", "", [Go$Int, Go$Int, Go$Int], [], false], ["DrawElements", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Enable", "", [Go$Int], [], false], ["EnableVertexAttribArray", "", [Go$Int], [], false], ["Finish", "", [], [], false], ["Float", "", [], [Go$Float64], false], ["Flush", "", [], [], false], ["FrameBufferRenderBuffer", "", [Go$Int, Go$Int, Go$Int, js.Object], [], false], ["FramebufferTexture2D", "", [Go$Int, Go$Int, Go$Int, js.Object, Go$Int], [], false], ["FrontFace", "", [Go$Int], [], false], ["GenerateMipmap", "", [Go$Int], [], false], ["Get", "", [Go$String], [js.Object], false], ["GetActiveAttrib", "", [js.Object, Go$Int], [js.Object], false], ["GetActiveUniform", "", [js.Object, Go$Int], [js.Object], false], ["GetAttachedShaders", "", [js.Object], [(go$sliceType(js.Object))], false], ["GetAttribLocation", "", [js.Object, Go$String], [Go$Int], false], ["GetBufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetContextAttributes", "", [], [webgl.ContextAttributes], false], ["GetError", "", [], [Go$Int], false], ["GetExtension", "", [Go$String], [js.Object], false], ["GetFramebufferAttachmentParameter", "", [Go$Int, Go$Int, Go$Int], [js.Object], false], ["GetParameter", "", [Go$Int], [js.Object], false], ["GetProgramInfoLog", "", [js.Object], [Go$String], false], ["GetProgramParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetProgramParameteri", "", [js.Object, Go$Int], [Go$Int], false], ["GetRenderbufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetShaderInfoLog", "", [js.Object], [Go$String], false], ["GetShaderParameter", "", [js.Object, Go$Int], [js.Object], false], ["GetShaderParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetShaderSource", "", [js.Object], [Go$String], false], ["GetSupportedExtensions", "", [], [(go$sliceType(Go$String))], false], ["GetTexParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetUniform", "", [js.Object, js.Object], [js.Object], false], ["GetUniformLocation", "", [js.Object, Go$String], [js.Object], false], ["GetVertexAttrib", "", [Go$Int, Go$Int], [js.Object], false], ["GetVertexAttribOffset", "", [Go$Int, Go$Int], [Go$Int], false], ["Height", "", [], [Go$Float32], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsBuffer", "", [js.Object], [Go$Bool], false], ["IsContextLost", "", [], [Go$Bool], false], ["IsEnabled", "", [Go$Int], [Go$Bool], false], ["IsFramebuffer", "", [js.Object], [Go$Bool], false], ["IsNull", "", [], [Go$Bool], false], ["IsProgram", "", [js.Object], [Go$Bool], false], ["IsRenderbuffer", "", [js.Object], [Go$Bool], false], ["IsShader", "", [js.Object], [Go$Bool], false], ["IsTexture", "", [js.Object], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["LineWidth", "", [Go$Float64], [], false], ["LinkProgram", "", [js.Object], [], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["OnLoss", "", [(go$funcType([], [], false))], [], false], ["OnRestored", "", [(go$funcType([], [], false))], [], false], ["PixelRatio", "", [], [Go$Int], false], ["PixelStorei", "", [Go$Int, Go$Int], [], false], ["PolygonOffset", "", [Go$Float64, Go$Float64], [], false], ["ReadPixels", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["RenderbufferStorage", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Resize", "", [Go$Int, Go$Int, Go$Bool], [], false], ["Scissor", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["ShaderSource", "", [js.Object, Go$String], [], false], ["String", "", [], [Go$String], false], ["TexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["TexParameteri", "", [Go$Int, Go$Int, Go$Int], [], false], ["TexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["Uniform1f", "", [js.Object, Go$Float32], [], false], ["Uniform1i", "", [js.Object, Go$Int], [], false], ["Uniform2f", "", [js.Object, Go$Float32, Go$Float32], [], false], ["Uniform2i", "", [js.Object, Go$Int, Go$Int], [], false], ["Uniform3f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform3i", "", [js.Object, Go$Int, Go$Int, Go$Int], [], false], ["Uniform4f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform4i", "", [js.Object, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["UniformMatrix2fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix3fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix4fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UseProgram", "", [js.Object], [], false], ["ValidateProgram", "", [js.Object], [], false], ["VertexAttribPointer", "", [Go$Int, Go$Int, Go$Int, Go$Bool, Go$Int, Go$Int], [], false], ["Viewport", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Width", "", [], [Go$Float32], false]];
	(go$ptrType(Game)).methods = [["ActiveTexture", "", [Go$Int], [], false], ["AddResource", "", [Managed], [], false], ["AttachShader", "", [js.Object, js.Object], [], false], ["BindAttribLocation", "", [js.Object, Go$Int, Go$String], [], false], ["BindBuffer", "", [Go$Int, js.Object], [], false], ["BindFramebuffer", "", [Go$Int, js.Object], [], false], ["BindRenderbuffer", "", [Go$Int, js.Object], [], false], ["BindTexture", "", [Go$Int, js.Object], [], false], ["BlendColor", "", [Go$Float64, Go$Float64, Go$Float64, Go$Float64], [], false], ["BlendEquation", "", [Go$Int], [], false], ["BlendEquationSeparate", "", [Go$Int, Go$Int], [], false], ["BlendFunc", "", [Go$Int, Go$Int], [], false], ["BlendFuncSeparate", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Bool", "", [], [Go$Bool], false], ["BufferData", "", [Go$Int, js.Object, Go$Int], [], false], ["BufferSubData", "", [Go$Int, Go$Int, js.Object], [], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["CheckFramebufferStatus", "", [Go$Int], [Go$Int], false], ["Clear", "", [Go$Int], [], false], ["ClearColor", "", [Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["ClearDepth", "", [Go$Float64], [], false], ["ClearStencil", "", [Go$Int], [], false], ["ColorMask", "", [Go$Bool, Go$Bool, Go$Bool, Go$Bool], [], false], ["CompileShader", "", [js.Object], [], false], ["CopyTexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CopyTexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["CreateBuffer", "", [], [js.Object], false], ["CreateFramebuffer", "", [], [js.Object], false], ["CreateProgram", "", [], [js.Object], false], ["CreateRenderbuffer", "", [], [js.Object], false], ["CreateShader", "", [Go$Int], [js.Object], false], ["CreateTexture", "", [], [js.Object], false], ["CullFace", "", [Go$Int], [], false], ["DeleteBuffer", "", [js.Object], [], false], ["DeleteFramebuffer", "", [js.Object], [], false], ["DeleteProgram", "", [js.Object], [], false], ["DeleteRenderbuffer", "", [js.Object], [], false], ["DeleteShader", "", [js.Object], [], false], ["DeleteTexture", "", [js.Object], [], false], ["DepthFunc", "", [Go$Int], [], false], ["DepthMask", "", [Go$Bool], [], false], ["DepthRange", "", [Go$Float64, Go$Float64], [], false], ["DetachShader", "", [js.Object, js.Object], [], false], ["Disable", "", [Go$Int], [], false], ["DisableVertexAttribArray", "", [Go$Int], [], false], ["DrawArrays", "", [Go$Int, Go$Int, Go$Int], [], false], ["DrawElements", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Enable", "", [Go$Int], [], false], ["EnableVertexAttribArray", "", [Go$Int], [], false], ["Finish", "", [], [], false], ["Float", "", [], [Go$Float64], false], ["Flush", "", [], [], false], ["Fps", "", [], [Go$Float32], false], ["FrameBufferRenderBuffer", "", [Go$Int, Go$Int, Go$Int, js.Object], [], false], ["FramebufferTexture2D", "", [Go$Int, Go$Int, Go$Int, js.Object, Go$Int], [], false], ["FrontFace", "", [Go$Int], [], false], ["GenerateMipmap", "", [Go$Int], [], false], ["Get", "", [Go$String], [js.Object], false], ["GetActiveAttrib", "", [js.Object, Go$Int], [js.Object], false], ["GetActiveUniform", "", [js.Object, Go$Int], [js.Object], false], ["GetAttachedShaders", "", [js.Object], [(go$sliceType(js.Object))], false], ["GetAttribLocation", "", [js.Object, Go$String], [Go$Int], false], ["GetBufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetContextAttributes", "", [], [webgl.ContextAttributes], false], ["GetError", "", [], [Go$Int], false], ["GetExtension", "", [Go$String], [js.Object], false], ["GetFramebufferAttachmentParameter", "", [Go$Int, Go$Int, Go$Int], [js.Object], false], ["GetParameter", "", [Go$Int], [js.Object], false], ["GetProgramInfoLog", "", [js.Object], [Go$String], false], ["GetProgramParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetProgramParameteri", "", [js.Object, Go$Int], [Go$Int], false], ["GetRenderbufferParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetShaderInfoLog", "", [js.Object], [Go$String], false], ["GetShaderParameter", "", [js.Object, Go$Int], [js.Object], false], ["GetShaderParameterb", "", [js.Object, Go$Int], [Go$Bool], false], ["GetShaderSource", "", [js.Object], [Go$String], false], ["GetSupportedExtensions", "", [], [(go$sliceType(Go$String))], false], ["GetTexParameter", "", [Go$Int, Go$Int], [js.Object], false], ["GetUniform", "", [js.Object, js.Object], [js.Object], false], ["GetUniformLocation", "", [js.Object, Go$String], [js.Object], false], ["GetVertexAttrib", "", [Go$Int, Go$Int], [js.Object], false], ["GetVertexAttribOffset", "", [Go$Int, Go$Int], [Go$Int], false], ["Height", "", [], [Go$Float32], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsBuffer", "", [js.Object], [Go$Bool], false], ["IsContextLost", "", [], [Go$Bool], false], ["IsEnabled", "", [Go$Int], [Go$Bool], false], ["IsFramebuffer", "", [js.Object], [Go$Bool], false], ["IsNull", "", [], [Go$Bool], false], ["IsProgram", "", [js.Object], [Go$Bool], false], ["IsRenderbuffer", "", [js.Object], [Go$Bool], false], ["IsShader", "", [js.Object], [Go$Bool], false], ["IsTexture", "", [js.Object], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["LineWidth", "", [Go$Float64], [], false], ["LinkProgram", "", [js.Object], [], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["NewBatch", "", [], [(go$ptrType(Batch))], false], ["NewShader", "", [Go$String, Go$String], [(go$ptrType(Shader))], false], ["NewTexture", "", [Go$String, Go$Bool], [(go$ptrType(Texture))], false], ["OnLoss", "", [(go$funcType([], [], false))], [], false], ["OnRestored", "", [(go$funcType([], [], false))], [], false], ["PixelRatio", "", [], [Go$Int], false], ["PixelStorei", "", [Go$Int, Go$Int], [], false], ["PolygonOffset", "", [Go$Float64, Go$Float64], [], false], ["ReadPixels", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["RenderbufferStorage", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Resize", "", [Go$Int, Go$Int, Go$Bool], [], false], ["Scissor", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetBgColor", "", [Go$Uint8, Go$Uint8, Go$Uint8, Go$Uint8], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["ShaderSource", "", [js.Object, Go$String], [], false], ["String", "", [], [Go$String], false], ["TexImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["TexParameteri", "", [Go$Int, Go$Int, Go$Int], [], false], ["TexSubImage2D", "", [Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, Go$Int, js.Object], [], false], ["Uniform1f", "", [js.Object, Go$Float32], [], false], ["Uniform1i", "", [js.Object, Go$Int], [], false], ["Uniform2f", "", [js.Object, Go$Float32, Go$Float32], [], false], ["Uniform2i", "", [js.Object, Go$Int, Go$Int], [], false], ["Uniform3f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform3i", "", [js.Object, Go$Int, Go$Int, Go$Int], [], false], ["Uniform4f", "", [js.Object, Go$Float32, Go$Float32, Go$Float32, Go$Float32], [], false], ["Uniform4i", "", [js.Object, Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["UniformMatrix2fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix3fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UniformMatrix4fv", "", [js.Object, Go$Bool, (go$sliceType(Go$Float32))], [], false], ["UseProgram", "", [js.Object], [], false], ["ValidateProgram", "", [js.Object], [], false], ["VertexAttribPointer", "", [Go$Int, Go$Int, Go$Int, Go$Bool, Go$Int, Go$Int], [], false], ["Viewport", "", [Go$Int, Go$Int, Go$Int, Go$Int], [], false], ["Width", "", [], [Go$Float32], false], ["animate", "github.com/ajhager/enj", [Go$Float32], [], false], ["create", "github.com/ajhager/enj", [Go$Float32], [], false]];
	Shader.init([["", "", js.Object, ""], ["gl", "github.com/ajhager/enj", (go$ptrType(Canvas)), ""]]);
	Shader.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Shader)).methods = [["Bind", "", [], [], false], ["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType((go$interfaceType([]))))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["GetAttrib", "", [Go$String], [Go$Int], false], ["GetUniform", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [(go$interfaceType([]))], false], ["Invoke", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType((go$interfaceType([]))))], [js.Object], true], ["Set", "", [Go$String, (go$interfaceType([]))], [], false], ["SetIndex", "", [Go$Int, (go$interfaceType([]))], [], false], ["String", "", [], [Go$String], false]];
	Region.init([["texture", "github.com/ajhager/enj", (go$ptrType(Texture)), ""], ["u", "github.com/ajhager/enj", Go$Float32, ""], ["v", "github.com/ajhager/enj", Go$Float32, ""], ["u2", "github.com/ajhager/enj", Go$Float32, ""], ["v2", "github.com/ajhager/enj", Go$Float32, ""], ["width", "github.com/ajhager/enj", Go$Float32, ""], ["height", "github.com/ajhager/enj", Go$Float32, ""]]);
	(go$ptrType(Region)).methods = [["Flip", "", [Go$Bool, Go$Bool], [], false], ["Height", "", [], [Go$Float32], false], ["Width", "", [], [Go$Float32], false]];
	Texture.init([["gl", "github.com/ajhager/enj", (go$ptrType(Canvas)), ""], ["tex", "github.com/ajhager/enj", js.Object, ""], ["img", "github.com/ajhager/enj", js.Object, ""], ["minFilter", "github.com/ajhager/enj", Go$Int, ""], ["maxFilter", "github.com/ajhager/enj", Go$Int, ""], ["uWrap", "github.com/ajhager/enj", Go$Int, ""], ["vWrap", "github.com/ajhager/enj", Go$Int, ""], ["mipmaps", "github.com/ajhager/enj", Go$Bool, ""]]);
	(go$ptrType(Texture)).methods = [["Bind", "", [], [], false], ["Create", "", [], [], false], ["Filter", "", [], [Go$Int, Go$Int], false], ["Height", "", [], [Go$Int], false], ["Region", "", [Go$Int, Go$Int, Go$Int, Go$Int], [(go$ptrType(Region))], false], ["SetFilter", "", [Go$Int, Go$Int], [], false], ["SetWrap", "", [Go$Int, Go$Int], [], false], ["Split", "", [Go$Int, Go$Int], [(go$sliceType((go$ptrType(Region))))], false], ["Unbind", "", [], [], false], ["Width", "", [], [Go$Int], false], ["Wrap", "", [], [Go$Int, Go$Int], false]];
	var NewAssets = function() {
		return new Assets.Ptr((go$sliceType(Go$String)).make(0, 0, function() { return ""; }), new Go$Map(), 0, 0);
	};
	Assets.prototype.Image = function(path) { return this.go$val.Image(path); };
	Assets.Ptr.prototype.Image = function(path) {
		var a;
		a = this;
		a.queue = go$append(a.queue, path);
	};
	Assets.prototype.Load = function(onFinish) { return this.go$val.Load(onFinish); };
	Assets.Ptr.prototype.Load = function(onFinish) {
		var a, _ref, _i, _slice, _index, path, img, _key;
		a = this;
		if (a.queue.length === 0) {
			onFinish();
		} else {
			_ref = a.queue;
			_i = 0;
			for (; _i < _ref.length; _i += 1) {
				path = (_slice = _ref, _index = _i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
				img = new go$global.Image();
				img.addEventListener(go$externalize("load", Go$String), go$externalize((function() {
					a.loads = (a.loads + 1 >> 0);
					if ((a.loads + a.errors >> 0) === a.queue.length) {
						onFinish();
					}
				}), (go$funcType([], [], false))), go$externalize(false, Go$Bool));
				img.addEventListener(go$externalize("error", Go$String), go$externalize((function() {
					a.errors = (a.errors + 1 >> 0);
					if ((a.loads + a.errors >> 0) === a.queue.length) {
						onFinish();
					}
				}), (go$funcType([], [], false))), go$externalize(false, Go$Bool));
				img.src = go$externalize(path, Go$String);
				_key = path, (a.cache || go$throwRuntimeError("assignment to entry in nil map"))[_key] = { k: _key, v: img };
			}
		}
	};
	var colorToFloat = function(r, g, b, a) {
		var i;
		i = (((((((((((a >>> 0) << 24 >>> 0) | ((b >>> 0) << 16 >>> 0)) >>> 0) | ((g >>> 0) << 8 >>> 0)) >>> 0) | (r >>> 0)) >>> 0)) & 4278190079) >>> 0);
		i32[0] = i;
		return go$parseFloat(f32[0]);
	};
	var NewBatch = function(gl) {
		var batch, _tuple, i, j, _tuple$1;
		batch = new Batch.Ptr();
		batch.gl = gl;
		batch.shader = NewShader(gl, batchVert, batchFrag);
		batch.inPosition = batch.shader.GetAttrib("in_Position");
		batch.inColor = batch.shader.GetAttrib("in_Color");
		batch.inTexCoords = batch.shader.GetAttrib("in_TexCoords");
		batch.ufProjection = batch.shader.GetUniform("uf_Projection");
		batch.color = colorToFloat(255, 255, 255, 255);
		batch.vertices = new go$global.Float32Array(200000);
		batch.indices = new go$global.Uint16Array(60000);
		_tuple = [0, 0], i = _tuple[0], j = _tuple[1];
		while (i < 60000) {
			batch.indices[(i + 0 >> 0)] = (j + 0 >> 0);
			batch.indices[(i + 1 >> 0)] = (j + 1 >> 0);
			batch.indices[(i + 2 >> 0)] = (j + 2 >> 0);
			batch.indices[(i + 3 >> 0)] = (j + 2 >> 0);
			batch.indices[(i + 4 >> 0)] = (j + 1 >> 0);
			batch.indices[(i + 5 >> 0)] = (j + 3 >> 0);
			_tuple$1 = [(i + 6 >> 0), (j + 4 >> 0)], i = _tuple$1[0], j = _tuple$1[1];
		}
		batch.vertexVBO = gl.Context.CreateBuffer();
		batch.indexVBO = gl.Context.CreateBuffer();
		gl.Context.BindBuffer(34963, batch.indexVBO);
		gl.Context.BufferData(34963, batch.indices, 35044);
		gl.Context.BindBuffer(34962, batch.vertexVBO);
		gl.Context.BufferData(34962, batch.vertices, 35048);
		batch.projX = gl.Width() / 2;
		batch.projY = gl.Height() / 2;
		batch.blendingDisabled = false;
		batch.blendSrcFunc = 770;
		batch.blendDstFunc = 771;
		return batch;
	};
	Batch.prototype.Begin = function() { return this.go$val.Begin(); };
	Batch.Ptr.prototype.Begin = function() {
		var b, shader;
		b = this;
		if (b.drawing) {
			throw go$panic(new Go$String("Batch.End() must be called first"));
		}
		b.drawing = true;
		shader = b.shader;
		if (!(b.customShader === (go$ptrType(Shader)).nil)) {
			shader = b.customShader;
		}
		shader.Bind();
	};
	Batch.prototype.End = function() { return this.go$val.End(); };
	Batch.Ptr.prototype.End = function() {
		var b;
		b = this;
		if (!b.drawing) {
			throw go$panic(new Go$String("Batch.Begin() must be called first"));
		}
		if (b.index > 0) {
			b.flush();
		}
		if (!b.blendingDisabled) {
			b.gl.Context.Disable(3042);
		}
		b.drawing = false;
		b.gl.Context.BindBuffer(34962, null);
		b.gl.Context.UseProgram(null);
		b.lastTexture = (go$ptrType(Texture)).nil;
	};
	Batch.prototype.flush = function() { return this.go$val.flush(); };
	Batch.Ptr.prototype.flush = function() {
		var b, gl, x, x$1, view, x$2, x$3;
		b = this;
		if (b.lastTexture === (go$ptrType(Texture)).nil) {
			return;
		}
		gl = b.gl;
		if (b.blendingDisabled) {
			gl.Context.Disable(3042);
		} else {
			gl.Context.Enable(3042);
			gl.Context.BlendFunc(b.blendSrcFunc, b.blendDstFunc);
		}
		b.lastTexture.Bind();
		gl.Context.Uniform2f(b.ufProjection, b.projX, b.projY);
		gl.Context.BindBuffer(34962, b.vertexVBO);
		if (b.index > 5000) {
			gl.Context.BufferSubData(34962, 0, b.vertices);
		} else {
			view = b.vertices.subarray(0, (x = b.index, x$1 = 20, ((((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0)));
			gl.Context.BufferSubData(34962, 0, view);
		}
		gl.Context.EnableVertexAttribArray(b.inPosition);
		gl.Context.EnableVertexAttribArray(b.inTexCoords);
		gl.Context.EnableVertexAttribArray(b.inColor);
		gl.Context.VertexAttribPointer(b.inPosition, 2, 5126, false, 20, 0);
		gl.Context.VertexAttribPointer(b.inTexCoords, 2, 5126, false, 20, 8);
		gl.Context.VertexAttribPointer(b.inColor, 4, 5121, true, 20, 16);
		gl.Context.BindBuffer(34963, b.indexVBO);
		gl.Context.DrawElements(4, (x$2 = b.index, x$3 = 6, ((((x$2 >>> 16 << 16) * x$3 >> 0) + (x$2 << 16 >>> 16) * x$3) >> 0)), 5123, 0);
		b.index = 0;
	};
	Batch.prototype.Draw = function(r, x, y, originX, originY, scaleX, scaleY, rotation) { return this.go$val.Draw(r, x, y, originX, originY, scaleX, scaleY, rotation); };
	Batch.Ptr.prototype.Draw = function(r, x, y, originX, originY, scaleX, scaleY, rotation) {
		var b, worldOriginX, worldOriginY, fx, fy, fx2, fy2, p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y, x1, y1, x2, y2, x3, y3, x4, y4, rot, cos, sin, x$1, x$2, idx;
		b = this;
		if (!b.drawing) {
			throw go$panic(new Go$String("Batch.Begin() must be called first"));
		}
		if (!(r.texture === b.lastTexture)) {
			b.flush();
			b.lastTexture = r.texture;
		}
		worldOriginX = x + originX;
		worldOriginY = y + originY;
		fx = -originX;
		fy = -originY;
		fx2 = r.width - originX;
		fy2 = r.height - originY;
		if (!(scaleX === 1) || !(scaleY === 1)) {
			fx = fx * (scaleX);
			fy = fy * (scaleY);
			fx2 = fx2 * (scaleX);
			fy2 = fy2 * (scaleY);
		}
		p1x = fx;
		p1y = fy;
		p2x = fx;
		p2y = fy2;
		p3x = fx2;
		p3y = fy2;
		p4x = fx2;
		p4y = fy;
		x1 = 0;
		y1 = 0;
		x2 = 0;
		y2 = 0;
		x3 = 0;
		y3 = 0;
		x4 = 0;
		y4 = 0;
		if (!(rotation === 0)) {
			rot = rotation * 0.017453292519943295;
			cos = math.Cos(rot);
			sin = math.Sin(rot);
			x1 = cos * p1x - sin * p1y;
			y1 = sin * p1x + cos * p1y;
			x2 = cos * p2x - sin * p2y;
			y2 = sin * p2x + cos * p2y;
			x3 = cos * p3x - sin * p3y;
			y3 = sin * p3x + cos * p3y;
			x4 = x1 + (x3 - x2);
			y4 = y3 - (y2 - y1);
		} else {
			x1 = p1x;
			y1 = p1y;
			x2 = p2x;
			y2 = p2y;
			x3 = p3x;
			y3 = p3y;
			x4 = p4x;
			y4 = p4y;
		}
		x1 = x1 + (worldOriginX);
		y1 = y1 + (worldOriginY);
		x2 = x2 + (worldOriginX);
		y2 = y2 + (worldOriginY);
		x3 = x3 + (worldOriginX);
		y3 = y3 + (worldOriginY);
		x4 = x4 + (worldOriginX);
		y4 = y4 + (worldOriginY);
		idx = (x$1 = b.index, x$2 = 20, ((((x$1 >>> 16 << 16) * x$2 >> 0) + (x$1 << 16 >>> 16) * x$2) >> 0));
		b.vertices[(idx + 0 >> 0)] = x1;
		b.vertices[(idx + 1 >> 0)] = y1;
		b.vertices[(idx + 2 >> 0)] = r.u;
		b.vertices[(idx + 3 >> 0)] = r.v;
		b.vertices[(idx + 4 >> 0)] = b.color;
		b.vertices[(idx + 5 >> 0)] = x4;
		b.vertices[(idx + 6 >> 0)] = y4;
		b.vertices[(idx + 7 >> 0)] = r.u2;
		b.vertices[(idx + 8 >> 0)] = r.v;
		b.vertices[(idx + 9 >> 0)] = b.color;
		b.vertices[(idx + 10 >> 0)] = x2;
		b.vertices[(idx + 11 >> 0)] = y2;
		b.vertices[(idx + 12 >> 0)] = r.u;
		b.vertices[(idx + 13 >> 0)] = r.v2;
		b.vertices[(idx + 14 >> 0)] = b.color;
		b.vertices[(idx + 15 >> 0)] = x3;
		b.vertices[(idx + 16 >> 0)] = y3;
		b.vertices[(idx + 17 >> 0)] = r.u2;
		b.vertices[(idx + 18 >> 0)] = r.v2;
		b.vertices[(idx + 19 >> 0)] = b.color;
		b.index = (b.index + 1 >> 0);
		if (b.index >= 10000) {
			b.flush();
		}
	};
	Batch.prototype.SetColor = function(red, green, blue, alpha) { return this.go$val.SetColor(red, green, blue, alpha); };
	Batch.Ptr.prototype.SetColor = function(red, green, blue, alpha) {
		var b;
		b = this;
		b.color = colorToFloat(red, green, blue, alpha);
	};
	var NewCanvas = function(width, height, fullscreen, container, ca) {
		var document, view, target, devicePixelRatio, _tuple, gl, err, canvas;
		document = go$global.document;
		view = document.createElement(go$externalize("canvas", Go$String));
		target = document.getElementById(go$externalize(container, Go$String));
		if ((target === null)) {
			target = document.body;
		}
		target.appendChild(view);
		if (ca === (go$ptrType(webgl.ContextAttributes)).nil) {
			ca = webgl.DefaultAttributes();
		}
		devicePixelRatio = (go$parseInt(go$global.window.devicePixelRatio) >> 0);
		if (devicePixelRatio < 1) {
			devicePixelRatio = 1;
		}
		_tuple = webgl.NewContext(view, ca), gl = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [(go$ptrType(Canvas)).nil, err];
		}
		gl.Disable(2929);
		gl.Disable(2884);
		canvas = new Canvas.Ptr(view, gl, ca, 0, 0, devicePixelRatio, fullscreen, (go$sliceType(Managed)).make(0, 0, function() { return null; }));
		canvas.Resize(width, height, fullscreen);
		return [canvas, null];
	};
	Canvas.prototype.Resize = function(width, height, fullscreen) { return this.go$val.Resize(width, height, fullscreen); };
	Canvas.Ptr.prototype.Resize = function(width, height, fullscreen) {
		var c, x, x$1, window;
		c = this;
		c.width = width;
		c.height = height;
		c.Object.style.display = go$externalize("block", Go$String);
		c.Object.width = (x = c.pixelRatio, ((((width >>> 16 << 16) * x >> 0) + (width << 16 >>> 16) * x) >> 0));
		c.Object.height = (x$1 = c.pixelRatio, ((((height >>> 16 << 16) * x$1 >> 0) + (height << 16 >>> 16) * x$1) >> 0));
		if (fullscreen) {
			window = go$global.window;
			c.Object.style.width = (go$parseInt(window.innerWidth) >> 0);
			c.Object.style.height = (go$parseInt(window.innerHeight) >> 0);
		} else {
			c.Object.style.width = width;
			c.Object.style.height = height;
		}
		c.Context.Object.viewport(0, 0, c.Object.width, c.Object.height);
	};
	Canvas.prototype.OnLoss = function(handler) { return this.go$val.OnLoss(handler); };
	Canvas.Ptr.prototype.OnLoss = function(handler) {
		var c;
		c = this;
		c.Object.addEventListener(go$externalize("webglcontextlost", Go$String), go$externalize((function(event) {
			event.preventDefault();
			handler();
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
	};
	Canvas.prototype.OnRestored = function(handler) { return this.go$val.OnRestored(handler); };
	Canvas.Ptr.prototype.OnRestored = function(handler) {
		var c;
		c = this;
		c.Object.addEventListener(go$externalize("webglcontextrestored", Go$String), go$externalize((function(event) {
			var _tuple, _ref, _i, _slice, _index, resource;
			_tuple = webgl.NewContext(c.Object, c.attrs), c.Context = _tuple[0];
			c.Resize(c.width, c.height, c.fullscreen);
			_ref = c.resources;
			_i = 0;
			for (; _i < _ref.length; _i += 1) {
				resource = (_slice = _ref, _index = _i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
				resource.Create();
			}
			handler();
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
	};
	Canvas.prototype.Width = function() { return this.go$val.Width(); };
	Canvas.Ptr.prototype.Width = function() {
		var c;
		c = this;
		return c.width;
	};
	Canvas.prototype.Height = function() { return this.go$val.Height(); };
	Canvas.Ptr.prototype.Height = function() {
		var c;
		c = this;
		return c.height;
	};
	Canvas.prototype.PixelRatio = function() { return this.go$val.PixelRatio(); };
	Canvas.Ptr.prototype.PixelRatio = function() {
		var c;
		c = this;
		return c.pixelRatio;
	};
	Canvas.prototype.AddResource = function(r) { return this.go$val.AddResource(r); };
	Canvas.Ptr.prototype.AddResource = function(r) {
		var c;
		c = this;
		c.resources = go$append(c.resources, r);
	};
	var NewGame = function(width, height, fullscreen, container, responder) {
		var attrs, _tuple, canvas, err, game, dt, _recv;
		attrs = webgl.DefaultAttributes();
		attrs.Alpha = false;
		attrs.Depth = false;
		attrs.PremultipliedAlpha = false;
		attrs.Antialias = false;
		_tuple = NewCanvas(width, height, fullscreen, container, attrs), canvas = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			throw go$panic(err);
		}
		game = new Game.Ptr(responder, 0, 0, 0, 0, 0, NewAssets(), canvas);
		canvas.OnLoss((function() {
			CancelAnimationFrame(game.requestId);
		}));
		canvas.OnRestored((function() {
			var time, _recv;
			RequestAnimationFrame((_recv = game, function(time) { return _recv.animate(time); }));
		}));
		canvas.Object.addEventListener(go$externalize("mousemove", Go$String), go$externalize((function(ev) {
			var x, x$1, x$2, x$3, x$4, y;
			x$2 = (x = (((go$parseInt(ev.pageX) >> 0) - (go$parseInt(canvas.Object.offsetLeft) >> 0) >> 0)), x$1 = canvas.pixelRatio, ((((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0));
			y = (x$3 = (((go$parseInt(ev.pageY) >> 0) - (go$parseInt(canvas.Object.offsetTop) >> 0) >> 0)), x$4 = canvas.pixelRatio, ((((x$3 >>> 16 << 16) * x$4 >> 0) + (x$3 << 16 >>> 16) * x$4) >> 0));
			responder.Mouse(x$2, y, 0);
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
		canvas.Object.addEventListener(go$externalize("mousedown", Go$String), go$externalize((function(ev) {
			var x, x$1, x$2, x$3, x$4, y;
			x$2 = (x = (((go$parseInt(ev.pageX) >> 0) - (go$parseInt(canvas.Object.offsetLeft) >> 0) >> 0)), x$1 = canvas.pixelRatio, ((((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0));
			y = (x$3 = (((go$parseInt(ev.pageY) >> 0) - (go$parseInt(canvas.Object.offsetTop) >> 0) >> 0)), x$4 = canvas.pixelRatio, ((((x$3 >>> 16 << 16) * x$4 >> 0) + (x$3 << 16 >>> 16) * x$4) >> 0));
			responder.Mouse(x$2, y, 1);
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
		canvas.Object.addEventListener(go$externalize("mouseup", Go$String), go$externalize((function(ev) {
			var x, x$1, x$2, x$3, x$4, y;
			ev.preventDefault();
			x$2 = (x = (((go$parseInt(ev.pageX) >> 0) - (go$parseInt(canvas.Object.offsetLeft) >> 0) >> 0)), x$1 = canvas.pixelRatio, ((((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0));
			y = (x$3 = (((go$parseInt(ev.pageY) >> 0) - (go$parseInt(canvas.Object.offsetTop) >> 0) >> 0)), x$4 = canvas.pixelRatio, ((((x$3 >>> 16 << 16) * x$4 >> 0) + (x$3 << 16 >>> 16) * x$4) >> 0));
			responder.Mouse(x$2, y, 2);
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
		go$global.window.addEventListener(go$externalize("keypress", Go$String), go$externalize((function(ev) {
			responder.Key((go$parseInt(ev.charCode) >> 0), 3);
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
		go$global.window.addEventListener(go$externalize("keydown", Go$String), go$externalize((function(ev) {
			responder.Key((go$parseInt(ev.keyCode) >> 0), 4);
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
		go$global.window.addEventListener(go$externalize("keyup", Go$String), go$externalize((function(ev) {
			responder.Key((go$parseInt(ev.keyCode) >> 0), 5);
		}), (go$funcType([js.Object], [], false))), go$externalize(false, Go$Bool));
		RequestAnimationFrame((_recv = game, function(dt) { return _recv.create(dt); }));
		return game;
	};
	Game.prototype.create = function(dt) { return this.go$val.create(dt); };
	Game.Ptr.prototype.create = function(dt) {
		var game;
		game = this;
		game.responder.Load();
		game.Load.Load((function() {
			var time, _recv;
			game.responder.Setup();
			RequestAnimationFrame((_recv = game, function(time) { return _recv.animate(time); }));
		}));
	};
	Game.prototype.animate = function(time) { return this.go$val.animate(time); };
	Game.Ptr.prototype.animate = function(time) {
		var game, time$1, _recv;
		game = this;
		game.requestId = RequestAnimationFrame((_recv = game, function(time$1) { return _recv.animate(time$1); }));
		game.frames = game.frames + 1;
		if (time > game.lastSecond + 1000) {
			game.fps = math.Floor((game.frames * 1000) / (time - game.lastSecond));
			game.lastSecond = time;
			game.frames = 0;
		}
		game.responder.Update((time - game.lastTime) / 1000);
		game.lastTime = time;
		game.Canvas.Context.Clear(16384);
		game.responder.Draw();
	};
	Game.prototype.Fps = function() { return this.go$val.Fps(); };
	Game.Ptr.prototype.Fps = function() {
		var game;
		game = this;
		return game.fps;
	};
	Game.prototype.SetBgColor = function(r, g, b, a) { return this.go$val.SetBgColor(r, g, b, a); };
	Game.Ptr.prototype.SetBgColor = function(r, g, b, a) {
		var game;
		game = this;
		game.Canvas.Context.ClearColor(r / 255, g / 255, b / 255, a / 255);
	};
	Game.prototype.NewTexture = function(path, mipmaps) { return this.go$val.NewTexture(path, mipmaps); };
	Game.Ptr.prototype.NewTexture = function(path, mipmaps) {
		var game, ok, _tuple, _entry, image, texture;
		game = this;
		if (_tuple = (_entry = game.Load.cache[path], _entry !== undefined ? [_entry.v, true] : [null, false]), image = _tuple[0], ok = _tuple[1], ok) {
			texture = NewTexture(game.Canvas, image, mipmaps);
			return texture;
		}
		return (go$ptrType(Texture)).nil;
	};
	Game.prototype.NewShader = function(vertSrc, fragSrc) { return this.go$val.NewShader(vertSrc, fragSrc); };
	Game.Ptr.prototype.NewShader = function(vertSrc, fragSrc) {
		var game;
		game = this;
		return NewShader(game.Canvas, vertSrc, fragSrc);
	};
	Game.prototype.NewBatch = function() { return this.go$val.NewBatch(); };
	Game.Ptr.prototype.NewBatch = function() {
		var game;
		game = this;
		return NewBatch(game.Canvas);
	};
	var rafPolyfill = function() {
		var window, vendors, i, _slice, _index, vendor, lastTime;
		window = go$global.window;
		vendors = new (go$sliceType(Go$String))(["ms", "moz", "webkit", "o"]);
		if ((window.requestAnimationFrame === undefined)) {
			i = 0;
			while (i < vendors.length && (window.requestAnimationFrame === undefined)) {
				vendor = (_slice = vendors, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
				window.requestAnimationFrame = window[go$externalize(vendor + "RequestAnimationFrame", Go$String)];
				window.cancelAnimationFrame = window[go$externalize(vendor + "CancelAnimationFrame", Go$String)];
				if ((window.cancelAnimationFrame === undefined)) {
					window.cancelAnimationFrame = window[go$externalize(vendor + "CancelRequestAnimationFrame", Go$String)];
				}
				i = (i + 1 >> 0);
			}
		}
		lastTime = 0;
		if ((window.requestAnimationFrame === undefined)) {
			window.requestAnimationFrame = go$externalize((function(callback) {
				var currTime, timeToCall, id;
				currTime = go$parseFloat(new go$global.Date().getTime());
				timeToCall = math.Max(0, 16 - (currTime - lastTime));
				id = window.setTimeout(go$externalize((function() {
					callback(currTime + timeToCall);
				}), (go$funcType([], [], false))), timeToCall);
				lastTime = currTime + timeToCall;
				return (go$parseInt(id) >> 0);
			}), (go$funcType([(go$funcType([Go$Float32], [], false))], [Go$Int], false)));
		}
		if ((window.cancelAnimationFrame === undefined)) {
			window.cancelAnimationFrame = go$externalize((function(id) {
				go$global.clearTimeout(id);
			}), (go$funcType([Go$Int], [], false)));
		}
	};
	var RequestAnimationFrame = function(callback) {
		return (go$parseInt(go$global.window.requestAnimationFrame(go$externalize(callback, (go$funcType([Go$Float32], [], false))))) >> 0);
	};
	var CancelAnimationFrame = function(id) {
		go$global.window.cancelAnimationFrame();
	};
	var NewShader = function(gl, vertSrc, fragSrc) {
		var vertShader, fragShader, program;
		var go$deferred = [];
		try {
			vertShader = gl.Context.CreateShader(35633);
			gl.Context.ShaderSource(vertShader, vertSrc);
			gl.Context.CompileShader(vertShader);
			if (gl.Context.GetShaderParameterb(vertShader, 35713) === false) {
				console.log(gl.Context.GetShaderInfoLog(vertShader));
			}
			go$deferred.push({ recv: gl, method: "DeleteShader", args: [vertShader] });
			fragShader = gl.Context.CreateShader(35632);
			gl.Context.ShaderSource(fragShader, fragSrc);
			gl.Context.CompileShader(fragShader);
			if (gl.Context.GetShaderParameterb(fragShader, 35713) === false) {
				console.log(gl.Context.GetShaderInfoLog(fragShader));
			}
			go$deferred.push({ recv: gl, method: "DeleteShader", args: [fragShader] });
			program = gl.Context.CreateProgram();
			gl.Context.AttachShader(program, vertShader);
			gl.Context.AttachShader(program, fragShader);
			gl.Context.LinkProgram(program);
			if (!gl.Context.GetProgramParameterb(program, 35714)) {
				console.log(gl.Context.GetProgramInfoLog(program));
			}
			gl.Context.ValidateProgram(program);
			if (!gl.Context.GetProgramParameterb(program, 35715)) {
				console.log(gl.Context.GetProgramInfoLog(program));
			}
			return new Shader.Ptr(program, gl);
		} catch(go$err) {
			go$pushErr(go$err);
			return (go$ptrType(Shader)).nil;
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	Shader.prototype.Bind = function() { return this.go$val.Bind(); };
	Shader.Ptr.prototype.Bind = function() {
		var s;
		s = this;
		s.gl.Context.UseProgram(s.Object);
	};
	Shader.prototype.GetUniform = function(uniform) { return this.go$val.GetUniform(uniform); };
	Shader.Ptr.prototype.GetUniform = function(uniform) {
		var s;
		s = this;
		return s.gl.Context.GetUniformLocation(s.Object, uniform);
	};
	Shader.prototype.GetAttrib = function(attrib) { return this.go$val.GetAttrib(attrib); };
	Shader.Ptr.prototype.GetAttrib = function(attrib) {
		var s;
		s = this;
		return s.gl.Context.GetAttribLocation(s.Object, attrib);
	};
	Region.prototype.Flip = function(x, y) { return this.go$val.Flip(x, y); };
	Region.Ptr.prototype.Flip = function(x, y) {
		var r, tmp, tmp$1;
		r = this;
		if (x) {
			tmp = r.u;
			r.u = r.u2;
			r.u2 = tmp;
		}
		if (y) {
			tmp$1 = r.v;
			r.v = r.v2;
			r.v2 = tmp$1;
		}
	};
	Region.prototype.Width = function() { return this.go$val.Width(); };
	Region.Ptr.prototype.Width = function() {
		var r;
		r = this;
		return r.width;
	};
	Region.prototype.Height = function() { return this.go$val.Height(); };
	Region.Ptr.prototype.Height = function() {
		var r;
		r = this;
		return r.height;
	};
	var NewTexture = function(gl, image, mipmaps) {
		var texture;
		texture = new Texture.Ptr(gl, null, image, 9729, 9729, 33071, 33071, mipmaps);
		texture.Create();
		return texture;
	};
	Texture.prototype.Create = function() { return this.go$val.Create(); };
	Texture.Ptr.prototype.Create = function() {
		var t;
		t = this;
		t.tex = t.gl.Context.CreateTexture();
		t.gl.Context.BindTexture(3553, t.tex);
		t.gl.Context.TexParameteri(3553, 10242, t.uWrap);
		t.gl.Context.TexParameteri(3553, 10243, t.vWrap);
		t.gl.Context.TexParameteri(3553, 10241, t.minFilter);
		t.gl.Context.TexParameteri(3553, 10240, t.maxFilter);
		if (t.mipmaps) {
			t.gl.Context.GenerateMipmap(3553);
		}
		t.gl.Context.TexImage2D(3553, 0, 6408, 6408, 5121, t.img);
		t.gl.Context.BindTexture(3553, null);
	};
	Texture.prototype.Bind = function() { return this.go$val.Bind(); };
	Texture.Ptr.prototype.Bind = function() {
		var t;
		t = this;
		t.gl.Context.BindTexture(3553, t.tex);
	};
	Texture.prototype.Unbind = function() { return this.go$val.Unbind(); };
	Texture.Ptr.prototype.Unbind = function() {
		var t;
		t = this;
		t.gl.Context.BindTexture(3553, null);
	};
	Texture.prototype.Width = function() { return this.go$val.Width(); };
	Texture.Ptr.prototype.Width = function() {
		var t;
		t = this;
		return (go$parseInt(t.img.width) >> 0);
	};
	Texture.prototype.Height = function() { return this.go$val.Height(); };
	Texture.Ptr.prototype.Height = function() {
		var t;
		t = this;
		return (go$parseInt(t.img.height) >> 0);
	};
	Texture.prototype.SetFilter = function(min, max) { return this.go$val.SetFilter(min, max); };
	Texture.Ptr.prototype.SetFilter = function(min, max) {
		var t;
		t = this;
		t.minFilter = min;
		t.maxFilter = max;
		t.Bind();
		t.gl.Context.TexParameteri(3553, 10241, min);
		t.gl.Context.TexParameteri(3553, 10240, max);
		t.Unbind();
	};
	Texture.prototype.Filter = function() { return this.go$val.Filter(); };
	Texture.Ptr.prototype.Filter = function() {
		var t;
		t = this;
		return [t.minFilter, t.maxFilter];
	};
	Texture.prototype.SetWrap = function(u, v) { return this.go$val.SetWrap(u, v); };
	Texture.Ptr.prototype.SetWrap = function(u, v) {
		var t;
		t = this;
		t.uWrap = u;
		t.vWrap = v;
		t.Bind();
		t.gl.Context.TexParameteri(3553, 10242, u);
		t.gl.Context.TexParameteri(3553, 10243, v);
		t.Unbind();
	};
	Texture.prototype.Wrap = function() { return this.go$val.Wrap(); };
	Texture.Ptr.prototype.Wrap = function() {
		var t;
		t = this;
		return [t.uWrap, t.vWrap];
	};
	Texture.prototype.Region = function(x, y, w, h) { return this.go$val.Region(x, y, w, h); };
	Texture.Ptr.prototype.Region = function(x, y, w, h) {
		var t, invTexWidth, invTexHeight, u, v, u2, v2, width, height;
		t = this;
		invTexWidth = 1 / t.Width();
		invTexHeight = 1 / t.Height();
		u = x * invTexWidth;
		v = y * invTexHeight;
		u2 = (x + w >> 0) * invTexWidth;
		v2 = (y + h >> 0) * invTexHeight;
		width = math.Abs(w);
		height = math.Abs(h);
		return new Region.Ptr(t, u, v, u2, v2, width, height);
	};
	Texture.prototype.Split = function(w, h) { return this.go$val.Split(w, h); };
	Texture.Ptr.prototype.Split = function(w, h) {
		var t, x, y, width, height, _q, rows, _q$1, cols, startX, tiles, row, col;
		t = this;
		x = 0;
		y = 0;
		width = t.Width();
		height = t.Height();
		rows = (_q = height / h, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		cols = (_q$1 = width / w, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
		startX = x;
		tiles = (go$sliceType((go$ptrType(Region)))).make(0, 0, function() { return (go$ptrType(Region)).nil; });
		row = 0;
		while (row < rows) {
			x = startX;
			col = 0;
			while (col < cols) {
				tiles = go$append(tiles, t.Region(x, y, w, h));
				x = (x + (w) >> 0);
				col = (col + 1 >> 0);
			}
			y = (y + (h) >> 0);
			row = (row + 1 >> 0);
		}
		return tiles;
	};
	var size = 10000;
	var degToRad = 0.017453292519943295;
	go$pkg.MOUSEMOVE = 0;
	go$pkg.MOUSEDOWN = 1;
	go$pkg.MOUSEUP = 2;
	go$pkg.KEYTYPE = 3;
	go$pkg.KEYDOWN = 4;
	go$pkg.KEYUP = 5;
	var i8 = null;
	var i32 = null;
	var f32 = null;
	var batchVert = "";
	var batchFrag = "";
	go$pkg.NewAssets = NewAssets;
	go$pkg.NewBatch = NewBatch;
	go$pkg.NewCanvas = NewCanvas;
	go$pkg.NewGame = NewGame;
	go$pkg.RequestAnimationFrame = RequestAnimationFrame;
	go$pkg.CancelAnimationFrame = CancelAnimationFrame;
	go$pkg.NewShader = NewShader;
	go$pkg.NewTexture = NewTexture;
	go$pkg.init = function() {
		i8 = new go$global.Int8Array(4);
		i32 = new go$global.Int32Array(i8.buffer, 0, 1);
		f32 = new go$global.Float32Array(i8.buffer, 0, 1);
		batchVert = " \nattribute vec4 in_Position;\nattribute vec4 in_Color;\nattribute vec2 in_TexCoords;\n\n//uniform mat4 uf_Matrix;\nuniform vec2 uf_Projection;\n\nvarying vec4 var_Color;\nvarying vec2 var_TexCoords;\n\nvoid main() {\n  var_Color = in_Color;\n  var_TexCoords = in_TexCoords;\n  gl_Position = vec4(in_Position.x / uf_Projection.x - 1.0,\n                     in_Position.y / -uf_Projection.y + 1.0,\n                     0.0, 1.0);\n}\n";
		batchFrag = "\nprecision lowp float;\n\nvarying vec4 var_Color;\nvarying vec2 var_TexCoords;\n\nuniform sampler2D uf_Texture;\n\nvoid main (void) {\n  gl_FragColor = var_Color * texture2D (uf_Texture, var_TexCoords);\n}\n";
		rafPolyfill();
	};
  return go$pkg;
})();
go$packages["/Users/ajhager/go/src/github.com/ajhager/enj/demos/basics"] = (function() {
  var go$pkg = {};
	var enj = go$packages["github.com/ajhager/enj"];
	var webgl = go$packages["github.com/ajhager/webgl"];
	var math = go$packages["math"];
	var Basics;
	Basics = go$newType(4, "Int", "main.Basics", "Basics", "/Users/ajhager/go/src/github.com/ajhager/enj/demos/basics", null);
	go$pkg.Basics = Basics;
	(go$ptrType(Basics)).methods = [["Draw", "", [], [], false], ["Key", "", [Go$Int, Go$Int], [], false], ["Load", "", [], [], false], ["Mouse", "", [Go$Float32, Go$Float32, Go$Int], [], false], ["Setup", "", [], [], false], ["Update", "", [Go$Float32], [], false]];
	Basics.prototype.Load = function() { var obj = this.go$val; return (new (go$ptrType(Basics))(function() { return obj; }, null)).Load(); };
	go$ptrType(Basics).prototype.Load = function() {
		var b;
		b = this;
		game.Load.Image("bot.png");
	};
	Basics.prototype.Setup = function() { var obj = this.go$val; return (new (go$ptrType(Basics))(function() { return obj; }, null)).Setup(); };
	go$ptrType(Basics).prototype.Setup = function() {
		var b, texture;
		b = this;
		texture = game.NewTexture("bot.png", false);
		texture.SetFilter(9728, 9728);
		regions = texture.Split(32, 32);
		batch = game.NewBatch();
		down = 50;
		game.SetBgColor(30, 60, 90, 255);
	};
	Basics.prototype.Update = function(dt) { var obj = this.go$val; return (new (go$ptrType(Basics))(function() { return obj; }, null)).Update(dt); };
	go$ptrType(Basics).prototype.Update = function(dt) {
		var b;
		b = this;
		time = time + (dt * 200);
	};
	Basics.prototype.Draw = function() { var obj = this.go$val; return (new (go$ptrType(Basics))(function() { return obj; }, null)).Draw(); };
	go$ptrType(Basics).prototype.Draw = function() {
		var b, _slice, _index, _slice$1, _index$1;
		b = this;
		batch.Begin();
		batch.Draw((_slice = regions, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), mx - 16, my - 16, 16, 16, 2, 2, 0);
		batch.Draw((_slice$1 = regions, _index$1 = (4 + ((math.Mod(time, 6) >> 0) >> 0) >> 0), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), mx - 16 - down, my - 16, down + 16, 16, down / 50, down / 50, time / 2 + 90);
		batch.End();
	};
	Basics.prototype.Mouse = function(x, y, e) { var obj = this.go$val; return (new (go$ptrType(Basics))(function() { return obj; }, null)).Mouse(x, y, e); };
	go$ptrType(Basics).prototype.Mouse = function(x, y, e) {
		var b, _ref;
		b = this;
		_ref = e;
		if (_ref === 0) {
			mx = x;
			my = y;
		} else if (_ref === 1) {
			down = 100;
		} else if (_ref === 2) {
			down = 50;
		}
	};
	Basics.prototype.Key = function(key, e) { var obj = this.go$val; return (new (go$ptrType(Basics))(function() { return obj; }, null)).Key(key, e); };
	go$ptrType(Basics).prototype.Key = function(key, e) {
		var b;
		b = this;
		console.log(key);
	};
	var main = function() {
		game = enj.NewGame(960, 640, false, "example", go$newDataPointer(0, (go$ptrType(Basics))));
	};
	var game = (go$ptrType(enj.Game)).nil;
	var time = 0;
	var regions = (go$sliceType((go$ptrType(enj.Region)))).nil;
	var batch = (go$ptrType(enj.Batch)).nil;
	var mx = 0;
	var my = 0;
	var down = 0;
	go$pkg.main = main;
	go$pkg.init = function() {
	};
  return go$pkg;
})();
go$error.implementedBy = [go$packages["errors"].errorString.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString)];
go$packages["runtime"].Error.implementedBy = [go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString)];
go$packages["runtime"].stringer.implementedBy = [go$packages["github.com/ajhager/enj"].Canvas, go$packages["github.com/ajhager/enj"].Canvas.Ptr, go$packages["github.com/ajhager/enj"].Game, go$packages["github.com/ajhager/enj"].Game.Ptr, go$packages["github.com/ajhager/enj"].Shader, go$packages["github.com/ajhager/enj"].Shader.Ptr, go$packages["github.com/ajhager/webgl"].Context, go$packages["github.com/ajhager/webgl"].Context.Ptr];
go$packages["github.com/neelance/gopherjs/js"].Object.implementedBy = [go$packages["github.com/ajhager/enj"].Canvas, go$packages["github.com/ajhager/enj"].Canvas.Ptr, go$packages["github.com/ajhager/enj"].Game, go$packages["github.com/ajhager/enj"].Game.Ptr, go$packages["github.com/ajhager/enj"].Shader, go$packages["github.com/ajhager/enj"].Shader.Ptr, go$packages["github.com/ajhager/webgl"].Context, go$packages["github.com/ajhager/webgl"].Context.Ptr];
go$packages["github.com/ajhager/enj"].Managed.implementedBy = [go$packages["github.com/ajhager/enj"].Texture.Ptr];
go$packages["github.com/ajhager/enj"].Responder.implementedBy = [go$ptrType(go$packages["/Users/ajhager/go/src/github.com/ajhager/enj/demos/basics"].Basics)];
go$packages["runtime"].init();
go$packages["errors"].init();
go$packages["github.com/neelance/gopherjs/js"].init();
go$packages["github.com/ajhager/webgl"].init();
go$packages["math"].init();
go$packages["github.com/ajhager/enj"].init();
go$packages["/Users/ajhager/go/src/github.com/ajhager/enj/demos/basics"].init();
go$packages["/Users/ajhager/go/src/github.com/ajhager/enj/demos/basics"].main();
