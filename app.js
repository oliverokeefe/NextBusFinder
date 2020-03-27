;
var _controls = {
    Route: {
        code: "", parseCode: getRouteCode, element: undefined, validationElement: undefined,
        changeEventHandler: function () {
            validateAndSetCode("Route", "Route Not Found", populateDirections);
        }
    },
    Direction: {
        code: "", parseCode: getDirectionCode, element: undefined, validationElement: undefined,
        changeEventHandler: function () {
            var errorMsg = (_controls.Route.code === "") ? "Enter a valid Route" : "Direction not found on Route";
            validateAndSetCode("Direction", errorMsg, populateStops);
        }
    },
    Stop: {
        code: "", parseCode: getStopCode, element: undefined, validationElement: undefined,
        changeEventHandler: function () {
            var errorMsg = (_controls.Route.code === "" || _controls.Direction.code === "") ? "Enter a valid Route and Direction" : "Stop Not Found on Route in Direction";
            validateAndSetCode("Stop", errorMsg);
        }
    },
    Enter: {
        element: undefined, validationElement: undefined,
        clickEventHandler: function () {
            findNextBus();
        }
    }
};
/**
 * Array of all routes name and associated route code
 */
var _routes = [];
var _directions = [];
/**
 * Array of stops along the input route in the input direction. Populated after
 * the direction is verified with the route. Empty if the route, direction, or
 * the pair of them are invalid/empty. Also empty if the _stopsElement is invalid/empty.
 */
var _stops = [];
/**
 * The timepoint departures retrived using the provided Route Direction and Stop.
 * This will be an array of key-value pair objects. Most importatnly the 'Acutal'
 * and 'DepartureText' values
 */
var _timepointDepartures = [];
var _outputMainDiv;
var _outputSecondDiv;
/**
 * Base url for all GET requests.
 */
var _url = "https://svc.metrotransit.org/NexTrip";
var _getRoutes = "/Routes";
var _getDirections = "/Directions/"; // {ROUTE}
var _getStops = "/Stops/"; //{ROUTE}/{DIRECTION}
var _getTimepointDepartures = "/"; //{ROUTE}/{DIRECTION}/{STOP}
function validateAndSetCode(control, errorMsg, codeValidCallback) {
    var code = _controls[control].parseCode();
    if (_controls[control].element.value != "" && code === "") {
        _controls[control].code = "";
        setValidation(control, errorMsg);
    }
    else {
        _controls[control].code = code;
        setValidation(control, "");
        if (codeValidCallback) {
            codeValidCallback();
        }
    }
    if (_controls.Route.code != "" && _controls.Direction.code != "" && _controls.Stop.code != "") {
        setValidation("Enter", "");
    }
}
function setValidation(control, message) {
    _controls[control].validationElement.innerHTML = message;
    if (message != "") {
        _controls[control].element.classList.add("invalidInput");
    }
    else {
        _controls[control].element.classList.remove("invalidInput");
    }
}
/**
 * Checks if the _directionCode is valid for the _routeCode. Does not set either code, nor does this function compute them using the input.
 * Ensure the codes are set before calling this function.
 */
function validateDirectionWithRoute() {
    if (_controls.Route.code === "" || _controls.Direction.code === "") {
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (this.status === 0 || (this.status >= 200 && this.status < 300))) {
            var directions = JSON.parse(this.response);
            var isValid_1 = false;
            directions.forEach(function (direction) {
                if (direction.Value === _controls.Direction.code) {
                    isValid_1 = true;
                }
            });
            if (!isValid_1) {
                _controls.Direction.code = "";
                setValidation("Direction", "Direction not valid for Route");
            }
            else {
                setValidation("Direction", "");
                populateStops();
            }
        }
    };
    xhttp.open("GET", _url + _getDirections + _controls.Route.code);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
function findNextBus() {
    //Race condition where if you have valid input then change and input, this could fire using the valid previous input.
    if (_controls.Route.code === "" || _controls.Direction.code === "" || _controls.Stop.code === "") {
        setValidation("Enter", "Fix errors before finding next bus");
        return;
    }
    populateTimepointDeparture();
}
/**
 * Retrieves the code corresponding to the route name. "" if the route does not exist.
 * @returns The code for the route, or "" of no route exists
 */
function getRouteCode() {
    var targetRoute = _controls.Route.element.value.toLowerCase();
    var routeCode = "";
    var possibleRoutes = [];
    _routes.forEach(function (route) {
        if (route.Description.indexOf(targetRoute) != -1) {
            possibleRoutes.push(route);
        }
    });
    if (possibleRoutes.length === 1) {
        routeCode = possibleRoutes[0].Route;
    }
    return routeCode;
}
/**
 * Retrieves the code corresponding to the direction in _directions
 * @returns The code corresponding to the direction, or "" if invalid direction
 */
function getDirectionCode() {
    var targetDirection = "";
    switch (_controls.Direction.element.value.toLowerCase()) {
        case "south":
            targetDirection = "1";
            break;
        case "east":
            targetDirection = "2";
            break;
        case "west":
            targetDirection = "3";
            break;
        case "north":
            targetDirection = "4";
            break;
        default:
            break;
    }
    var directionCode = "";
    _directions.forEach(function (direction) {
        if (targetDirection === direction.Value) {
            directionCode = direction.Value;
        }
    });
    return directionCode;
}
/**
 * Retrieves the code corresponding to the stop name. "" if the stop does not exist.
 * @returns The code for the stop, or "" of no stop exists
 */
function getStopCode() {
    var targetStop = _controls.Stop.element.value.toLowerCase();
    var stopCode = "";
    var possibleStops = [];
    _stops.forEach(function (stp) {
        if (stp.Text.indexOf(targetStop) != -1) {
            possibleStops.push(stp);
        }
    });
    if (possibleStops.length === 1) {
        stopCode = possibleStops[0].Value;
    }
    return stopCode;
}
function getRouteName() {
    var routeName = "";
    _routes.forEach(function (route) {
        if (_controls.Route.code === route.Route) {
            routeName = route.Description;
        }
    });
    return routeName.toUpperCase();
}
function getDirectionName() {
    var directionName = "";
    _directions.forEach(function (direction) {
        if (_controls.Direction.code === direction.Value) {
            directionName = direction.Text;
        }
    });
    return directionName;
}
function getStopName() {
    var stopName = "";
    _stops.forEach(function (stp) {
        if (_controls.Stop.code === stp.Value) {
            stopName = stp.Text;
        }
    });
    return stopName.toUpperCase();
}
function displayResponse() {
    var outputMain = "";
    var outputSecond = "";
    //Should check if Actual and DepartureText have values.
    if (_timepointDepartures && _timepointDepartures.length > 0) {
        var timeUntilArrival = "";
        var busTimeRaw = _timepointDepartures[0].DepartureText;
        if (_timepointDepartures[0].Actual) {
            timeUntilArrival = busTimeRaw.substring(0, busTimeRaw.length - 4);
            if (timeUntilArrival === "") {
                timeUntilArrival = "0";
            }
        }
        else {
            var today = new Date();
            var busTimeSplit = busTimeRaw.split(":");
            var busDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(busTimeSplit[0]), parseInt(busTimeSplit[1]));
            timeUntilArrival = new Date(busDateTime.getTime() - today.getTime()).getMinutes();
        }
        outputMain = timeUntilArrival + " minutes";
        outputSecond = "The next " + getDirectionName() + " bus on route " + getRouteName() + " will arrive at " + getStopName() + " in " + timeUntilArrival + " minutes";
    }
    else {
        outputMain = "The last bus has left for the day";
    }
    _outputMainDiv.innerHTML = outputMain;
    _outputSecondDiv.innerHTML = outputSecond;
    return;
}
/**
 * Sends the Request using Route, Direction, and Stop
 */
function populateTimepointDeparture() {
    if (_controls.Route.code === "" || _controls.Direction.code === "" || _controls.Stop.code === "") {
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (this.status === 0 || (this.status >= 200 && this.status < 300))) {
            _timepointDepartures = JSON.parse(this.response);
            displayResponse();
        }
    };
    xhttp.open("GET", _url + _getTimepointDepartures + _controls.Route.code + "/" + _controls.Direction.code + "/" + _controls.Stop.code);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
/**
 * Populate a table with Route names and codes
 */
function populateRoutes() {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (this.status === 0 || (this.status >= 200 && this.status < 300))) {
            _routes = JSON.parse(this.response);
            _routes.forEach(function (route) {
                route.Description = route.Description.toLowerCase();
            });
            enableInputFields();
        }
    };
    xhttp.open("GET", _url + _getRoutes);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
function populateDirections(callback) {
    if (_controls.Route.code === "") {
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (this.status === 0 || (this.status >= 200 && this.status < 300))) {
            _directions = JSON.parse(this.response);
            if (_controls.Direction.element.value != "") {
                validateAndSetCode("Direction", "Direction Not Found on Route");
            }
            populateStops();
        }
    };
    xhttp.open("GET", _url + _getDirections + _controls.Route.code);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
function populateStops() {
    if (_controls.Route.code === "" || _controls.Direction.code === "") {
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (this.status === 0 || (this.status >= 200 && this.status < 300))) {
            _stops = JSON.parse(this.response);
            _stops.forEach(function (stp) {
                stp.Text = stp.Text.toLowerCase();
            });
            if (_controls.Stop.element.value != "") {
                validateAndSetCode("Stop", "Stop Not Found on Route in Direction");
            }
        }
    };
    xhttp.open("GET", _url + _getStops + _controls.Route.code + "/" + _controls.Direction.code);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
function populateDOMElementVariables() {
    _controls.Route.element = document.getElementById("Route");
    _controls.Route.validationElement = document.getElementById("RouteValidation");
    _controls.Direction.element = document.getElementById("Direction");
    _controls.Direction.validationElement = document.getElementById("DirectionValidation");
    _controls.Stop.element = document.getElementById("Stop");
    _controls.Stop.validationElement = document.getElementById("StopValidation");
    _controls.Enter.element = document.getElementById("EnterBtn");
    _controls.Enter.validationElement = document.getElementById("EnterValidation");
    _outputMainDiv = document.getElementById("OutputMain");
    _outputSecondDiv = document.getElementById("OutputSecond");
    setUpInputBindings();
}
function setUpInputBindings() {
    _controls.Route.element.addEventListener("change", _controls.Route.changeEventHandler);
    _controls.Direction.element.addEventListener("change", _controls.Direction.changeEventHandler);
    _controls.Stop.element.addEventListener("change", _controls.Stop.changeEventHandler);
    _controls.Enter.element.addEventListener("click", _controls.Enter.clickEventHandler);
    enableInputFields();
}
function enableInputFields() {
    if (_routes.length > 0 && _controls.Route.element && _controls.Direction.element && _controls.Stop.element) {
        _controls.Route.element.removeAttribute("disabled");
        _controls.Direction.element.removeAttribute("disabled");
        _controls.Stop.element.removeAttribute("disabled");
        _controls.Enter.element.removeAttribute("disabled");
        _controls.Route.element.focus();
    }
    else {
    }
}
function init() {
    populateRoutes();
    populateDOMElementVariables();
}
window.onload = function () {
    init();
};
/*
 * Outline
 *
 * 1. Use getRoute to find/verify the Route
 * 2. Use convert and verfiy direction to value
 * 3. Use getDirections to verify the Route and Direction
 * 4. Use getStops to verify the Stop on the Route in Direction
 * 5. Use Get_timepointDeparture to find the scheduled Departure for the Route, Direction, and Stop
 * IF (Acutal === "true")
 *  -Use DepartureText
 * ELSE
 *  -Do Math with DepartureText time and current time
 *
 *  Make sure to handle the case where the last bus for the day has already left.
 *
 * Possible DepartureText:
 * "X Min"
 * "Due"
 * "5:24"
 * null
 *
 * TestCase:
 *  Route - METRO Blue Line {901}
 *  Direction - South {1}
 *  Stop - Target Field Station Platform 1 {TF12}
 *
 *  Route - Express - Target - Hwy 252 and 73rd Av P&R -Mpls {765}
 *  Direction - South {1}
 *  Stop - Target North Campus Building F {TGBF}
 */
//# sourceMappingURL=app.js.map