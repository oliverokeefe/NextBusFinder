;
/**
 * The data model for the controls.
 */
var _data = {
    Route: {
        code: "", parseCode: getRouteCode, element: undefined, validationElement: undefined,
        helpMessage: "Enter the name of a route from below (or part of the name)",
        changeEventHandler: function () {
            validateAndSetCode("Route", "Route Not Found");
            populateDirections(populateStops);
        }
    },
    Direction: {
        code: "", parseCode: getDirectionCode, element: undefined, validationElement: undefined,
        helpMessage: "Enter the direction on the route (north, south, east, west)",
        changeEventHandler: function () {
            var errorMsg = (_data.Route.code === "") ? "Enter a valid Route" : "Route Does not run that direction";
            validateAndSetCode("Direction", errorMsg);
            populateStops();
        }
    },
    Stop: {
        code: "", parseCode: getStopCode, element: undefined, validationElement: undefined,
        helpMessage: "Enter the stop on the route",
        changeEventHandler: function () {
            var errorMsg = (_data.Route.code === "" || _data.Direction.code === "") ? "Enter a valid Route and Direction" : "Stop Not Found on Route in Direction";
            validateAndSetCode("Stop", errorMsg);
        }
    },
    Enter: {
        element: undefined, validationElement: undefined,
        helpMessage: "",
        clickEventHandler: function () {
            findNextBus();
        }
    }
};
/**
 * Array of all routes name and associated route code. The names are stored in all lower case for searches.
 * If this is empty, there was an error during init()
 */
var _routes = [];
/**
 * Array of all the directions associated with the input route. Only populated if a valid route has been entered. Stores the direction names corresponding codes.
 * This is empyt of the entered route is invalid.
 */
var _directions = [];
/**
 * Array of stops along the entered route in the entered direction. Only populated if a valid route and valid direction have are entered.
 * Empty there is not BOTH a valid route and valid direction.
 */
var _stops = [];
/**
 * Array of the timepoint Departures on the entered route, in the entered direction, from the entered stop. Only populated if after pressing the "Find Next Bus" button
 * with all fields having valid input. Used to find the time until the next bus arrives.
 */
var _timepointDepartures = [];
/**
 * The div element used to display the list of all routes available to the user.
 */
var _routeListElement;
/**
 * The div element used to display the list of all valid stops on the entered route in the entered direction.
 * Only displayed if the _stops array is populated.
 */
var _stopListElement;
/**
 * The div used to display the time until the bus arrives (or the message that there will be no bus).
 */
var _outputMainDiv;
/**
 * Base url of all GET requests for the Metro Transit API.
 */
var _url = "https://svc.metrotransit.org/NexTrip";
/*
 * The paths for the different API calls
 */
var _getRoutes = "/Routes";
var _getDirections = "/Directions/"; // {ROUTE}
var _getStops = "/Stops/"; //{ROUTE}/{DIRECTION}
var _getTimepointDepartures = "/"; //{ROUTE}/{DIRECTION}/{STOP}
/**
 * The message that displays in the alert when a GET request fails.
 */
var _httpRequestFailMsg = "Failed to get information from Metro Transit. Refresh page and try again. If that fails try again later.";
/**
 * Validates the input to the 'control' control and sets the code if valid. If the input is invalid this will mark the control as invalid and display
 * an error message.
 * @param control The control to validate and set.
 * @param errorMsg The message to display if the input is invalid.
 */
function validateAndSetCode(control, errorMsg) {
    _data[control].code = _data[control].parseCode();
    if (_data[control].element.value != "" && _data[control].code === "") {
        setValidation(control, errorMsg);
    }
    else {
        setValidation(control);
    }
    if (_data.Route.code != "" && _data.Direction.code != "" && _data.Stop.code != "") {
        setValidation("Enter");
    }
    return;
}
/**
 * If given a message, marks the control as invalid and displays the error message. Otherwise it clears validation error markings/messages
 * and displays the controls default help message instead.
 * @param control The control to set validation on.
 * @param message The error message to display
 */
function setValidation(control, message) {
    if (message) {
        _data[control].validationElement.innerHTML = message;
        _data[control].validationElement.classList.add("validation");
        _data[control].element.classList.add("invalidInput");
    }
    else {
        _data[control].validationElement.innerHTML = _data[control].helpMessage;
        _data[control].validationElement.classList.remove("validation");
        _data[control].element.classList.remove("invalidInput");
    }
    return;
}
/**
 * Clears any input of the controls and displays their help messages. This does use validateAndSetCode to clear the control's data as well.
 * The controls will be disabled while the data is clearing, and enabled when the data is cleared.
 */
function clearInputAndDisplayHelp() {
    disableInputFields();
    _data.Route.element.value = "";
    _data.Direction.element.value = "";
    _data.Stop.element.value = "";
    validateAndSetCode("Route", "");
    validateAndSetCode("Direction", "");
    validateAndSetCode("Stop", "");
    enableInputFields();
    return;
}
/**
 * Finds the and displays the time until the next bus. This runs when the button is pressed with valid input in all fields (route, direction, and stop).
 */
function findNextBus() {
    if (_data.Route.code === "" || _data.Direction.code === "" || _data.Stop.code === "") {
        setValidation("Enter", "Fix errors before finding next bus");
        return;
    }
    var callback = function () {
        setLoadingMessage();
        displayResponse();
        enableInputFields();
    };
    disableInputFields();
    setLoadingMessage("Loading...");
    populateTimepointDeparture(callback);
    return;
}
/**
 * If a message is passed, it is displayed. Otherwise any message that is set is removed.
 * @param message
 */
function setLoadingMessage(message) {
    if (message) {
        _data.Enter.validationElement.classList.add("placeholderText");
        _data.Enter.validationElement.innerHTML = message;
    }
    else {
        _data.Enter.validationElement.innerHTML = "";
        _data.Enter.validationElement.classList.remove("placeholderText");
    }
    return;
}
/**
 * Retrieves the code corresponding to the route name in _routes. "" if the route does not exist.
 * @returns The code for the route, or "" of no route exists
 */
function getRouteCode() {
    var targetRoute = _data.Route.element.value.toLowerCase();
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
    switch (_data.Direction.element.value.toLowerCase()) {
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
 * Retrieves the code corresponding to the stop name in _stops. "" if the stop does not exist.
 * @returns The code for the stop, or "" of no stop exists
 */
function getStopCode() {
    var targetStop = _data.Stop.element.value.toLowerCase();
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
/**
 * Displays when the next bus will arrive, or a message saying there are no more busses today.
 */
function displayResponse() {
    var outputMain = "";
    if (_timepointDepartures && _timepointDepartures.length > 0) {
        if (_timepointDepartures[0].DepartureText && _timepointDepartures[0].Actual != null && typeof (_timepointDepartures[0].Actual) != "undefined") {
            var timeUntilArrival = "";
            var busTimeRaw = _timepointDepartures[0].DepartureText;
            if (_timepointDepartures[0].Actual) {
                if (busTimeRaw === "Due") {
                    timeUntilArrival = "";
                }
                else if (busTimeRaw.length >= 4) {
                    timeUntilArrival = busTimeRaw.substring(0, busTimeRaw.length - 4);
                }
                else {
                    timeUntilArrival = "NAN";
                }
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
        }
        else {
            outputMain = _httpRequestFailMsg;
        }
    }
    else {
        outputMain = "The last bus has left for the day";
    }
    _outputMainDiv.classList.remove("placeholderText");
    _outputMainDiv.innerHTML = outputMain;
    return;
}
/**
 * Populates _timepointDepartures with the timepoint Departures using the Metro Transit API and the
 * valid route, direction, and stop that have been entered. If any of the entered values are invalid
 * than this clears _timepointDepartures and quits.
 * @param callback The callback to run after the GET request has successfully finished.
 */
function populateTimepointDeparture(callback) {
    if (_data.Route.code === "" || _data.Direction.code === "" || _data.Stop.code === "") {
        _timepointDepartures = [];
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE) {
            if (this.status === 0 || (this.status >= 200 && this.status < 300)) {
                _timepointDepartures = JSON.parse(this.response);
                if (callback) {
                    callback();
                }
            }
            else {
                alert(_httpRequestFailMsg);
            }
        }
    };
    xhttp.open("GET", _url + _getTimepointDepartures + _data.Route.code + "/" + _data.Direction.code + "/" + _data.Stop.code);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
/**
 * Populates _routes with all routes returned by the Metro Transit API.
 * @param callback The callback to run after the GET request has successfully finished.
 */
function populateRoutes(callback) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE) {
            if (this.status === 0 || (this.status >= 200 && this.status < 300)) {
                _routes = JSON.parse(this.response);
                if (_routes.length > 0) {
                    _routeListElement.classList.add("hide");
                    _routeListElement.innerHTML = "";
                    _routes.forEach(function (route) {
                        var routeName = document.createElement("div");
                        routeName.innerHTML = route.Description;
                        _routeListElement.appendChild(routeName);
                        route.Description = route.Description.toLowerCase();
                    });
                    _routeListElement.classList.remove("hide");
                }
                else {
                    alert(_httpRequestFailMsg);
                }
                if (callback) {
                    callback();
                }
            }
            else {
                alert(_httpRequestFailMsg);
            }
        }
    };
    xhttp.open("GET", _url + _getRoutes);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
/**
 * Populates _directions using the Metro Transit API and the valid route that has been entered.
 * If there is no valid route entered, this will clear _directions and quit.
 * @param callback The callback to run after the GET request has successfully finished.
 */
function populateDirections(callback) {
    if (_data.Route.code === "") {
        _directions = [];
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE) {
            if (this.status === 0 || (this.status >= 200 && this.status < 300)) {
                _directions = JSON.parse(this.response);
                if (_directions.length > 0) {
                    if (_data.Direction.element.value != "") {
                        validateAndSetCode("Direction", "Direction Not Found on Route");
                    }
                }
                else {
                    alert(_httpRequestFailMsg);
                }
                if (callback) {
                    callback();
                }
            }
            else {
                alert(_httpRequestFailMsg);
            }
        }
    };
    xhttp.open("GET", _url + _getDirections + _data.Route.code);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
/**
 * Populates _stops using the Metro Transit API and the valid entered route, and direction. If either
 * the route or direction are not valid, then this clears _stops as well as the displayed list and quits.
 * @param callback The callback to run after the GET request has successfully finished.
 */
function populateStops(callback) {
    if (_data.Route.code === "" || _data.Direction.code === "") {
        _stops = [];
        _stopListElement.classList.add("placeholderText");
        _stopListElement.innerHTML = "Stops will be listed once Route and Direction are entered";
        return;
    }
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE) {
            if (this.status === 0 || (this.status >= 200 && this.status < 300)) {
                _stops = JSON.parse(this.response);
                if (_stops.length > 0) {
                    _stopListElement.classList.add("hide");
                    _stopListElement.classList.remove("placeholderText");
                    _stopListElement.innerHTML = "";
                    _stops.forEach(function (stp) {
                        var stopName = document.createElement("div");
                        stopName.innerHTML = stp.Text;
                        _stopListElement.appendChild(stopName);
                        stp.Text = stp.Text.toLowerCase();
                    });
                    _stopListElement.classList.remove("hide");
                    if (_data.Stop.element.value != "") {
                        validateAndSetCode("Stop", "Stop Not Found on Route in Direction");
                    }
                }
                else {
                    alert(_httpRequestFailMsg);
                }
                if (callback) {
                    callback();
                }
            }
            else {
                alert(_httpRequestFailMsg);
            }
        }
    };
    xhttp.open("GET", _url + _getStops + _data.Route.code + "/" + _data.Direction.code);
    xhttp.setRequestHeader("Accept", "application/json");
    xhttp.send();
    return;
}
/**
 * Sets all the HTML Elements in _data.
 */
function populateDOMElementVariables() {
    _data.Route.element = document.getElementById("Route");
    _data.Route.validationElement = document.getElementById("RouteValidation");
    _data.Direction.element = document.getElementById("Direction");
    _data.Direction.validationElement = document.getElementById("DirectionValidation");
    _data.Stop.element = document.getElementById("Stop");
    _data.Stop.validationElement = document.getElementById("StopValidation");
    _data.Enter.element = document.getElementById("EnterBtn");
    _data.Enter.validationElement = document.getElementById("EnterValidation");
    _outputMainDiv = document.getElementById("OutputMain");
    _routeListElement = document.getElementById("RouteList");
    _stopListElement = document.getElementById("StopList");
    return;
}
/**
 * Adds listeners to the 'change' events of the input fields and the 'click' event of the button.
 */
function setUpInputBindings() {
    _data.Route.element.addEventListener("change", _data.Route.changeEventHandler);
    _data.Direction.element.addEventListener("change", _data.Direction.changeEventHandler);
    _data.Stop.element.addEventListener("change", _data.Stop.changeEventHandler);
    _data.Enter.element.addEventListener("click", _data.Enter.clickEventHandler);
    return;
}
/**
 * Enables all input fields and the enter button.
 */
function enableInputFields() {
    if (_data.Route.element && _data.Direction.element && _data.Stop.element) {
        _data.Route.element.removeAttribute("disabled");
        _data.Direction.element.removeAttribute("disabled");
        _data.Stop.element.removeAttribute("disabled");
        _data.Enter.element.removeAttribute("disabled");
        _data.Route.element.focus();
    }
    return;
}
/**
 * Disables all the input fields and the enter button.
 */
function disableInputFields() {
    if (_data.Route.element && _data.Direction.element && _data.Stop.element) {
        _data.Route.element.setAttribute("disabled", "true");
        _data.Direction.element.setAttribute("disabled", "true");
        _data.Stop.element.setAttribute("disabled", "true");
        _data.Enter.element.setAttribute("disabled", "true");
        _data.Route.element.focus();
    }
    return;
}
/**
 * initializes _data and the page for use.
 */
function init() {
    populateDOMElementVariables();
    setUpInputBindings();
    var callback = function () {
        clearInputAndDisplayHelp();
        setLoadingMessage();
        return;
    };
    setLoadingMessage("Loading...");
    populateRoutes(callback);
    return;
}
window.onload = function () {
    init();
    return;
};
//# sourceMappingURL=app.js.map