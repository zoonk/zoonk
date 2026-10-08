/**
 * Inside Pyodide: blocks the modules that reach JavaScript, and traces a run with
 * `sys.settrace`, recording each line of `main.py` once it has run (at the next line or return
 * of its frame) with the watched values at that moment.
 */
export const PYTHON_HARNESS = `
import json
import sys

for _name in ("js", "pyodide_js"):
    sys.modules.pop(_name, None)

class _BlockHost:
    def find_spec(self, name, path=None, target=None):
        if name.split(".")[0] in ("js", "pyodide_js"):
            raise ImportError(f"No module named '{name}'")
        return None

sys.meta_path.insert(0, _BlockHost())

class TooManySteps(Exception):
    pass

_state = {"events": [], "pending": {}, "watch": [], "limit": 0}

def _describe(value):
    if isinstance(value, bool):
        return ["boolean", value]
    if isinstance(value, int) and abs(value) <= 2 ** 53:
        return ["number", value]
    if isinstance(value, float) and value == value and abs(value) != float("inf"):
        return ["number", value]
    if isinstance(value, str):
        return ["string", value]
    return ["text", repr(value)[:200]]

def _read(frame, name):
    if name in frame.f_locals:
        return _describe(frame.f_locals[name])
    if name in frame.f_globals:
        return _describe(frame.f_globals[name])
    return None

def _trace(frame, event, arg):
    if frame.f_code.co_filename != "main.py":
        return None
    if event in ("line", "return"):
        line = _state["pending"].pop(id(frame), None)
        if line is not None:
            _state["events"].append([line, [_read(frame, name) for name in _state["watch"]]])
            if len(_state["events"]) > _state["limit"]:
                raise TooManySteps()
        if event == "line":
            _state["pending"][id(frame)] = frame.f_lineno
    return _trace

def start(watch, limit):
    _state.update(events=[], pending={}, watch=list(watch), limit=limit)
    sys.settrace(_trace)

def stop():
    sys.settrace(None)
    return json.dumps(_state["events"])
`;
