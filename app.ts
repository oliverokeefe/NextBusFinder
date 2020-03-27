
/**
 * Format of the route objects retrieved from the GET response.
 */
type RouteDataObj = { Description: string; ProviderID: string; Route: string };
type DirectionDataObj = { Text: string; Value: string };
type StopDataObj = { Text: string; Value: string };;
type TimepointDepartureObj = { Actual: boolean; DepartureText: string};
type InputContol = { code: string; parseCode: Function; element: HTMLInputElement; validationElement: HTMLSpanElement; changeEventHandler: EventListener }
type EnterBtn = { element: HTMLButtonElement; validationElement: HTMLSpanElement; clickEventHandler: EventListener }
type ControlsDataObj = { Route: InputContol; Direction: InputContol; Stop: InputContol; Enter: EnterBtn };
type ControlOptions = "Route" | "Direction" | "Stop";
type ValidationOptions = ControlOptions | "Enter";

let _controls: ControlsDataObj = {
    Route: {
        code: "", parseCode: getRouteCode, element: undefined, validationElement: undefined,
        changeEventHandler: function () {
            validateAndSetCode("Route", "Route Not Found", populateDirections);
        }
    },
    Direction: {
        code: "", parseCode: getDirectionCode, element: undefined, validationElement: undefined,
        changeEventHandler: function () {
            let errorMsg: string = (_controls.Route.code === "") ? "Enter a valid Route" : "Direction not found on Route";
            validateAndSetCode("Direction", errorMsg, populateStops);
        }
    },
    Stop: {
        code: "", parseCode: getStopCode, element: undefined, validationElement: undefined,
        changeEventHandler: function () {
            let errorMsg: string = (_controls.Route.code === "" || _controls.Direction.code === "") ? "Enter a valid Route and Direction" : "Stop Not Found on Route in Direction";
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
let _routes: Array<RouteDataObj> = [];

let _directions: Array<DirectionDataObj> = [];

/**
 * Array of stops along the input route in the input direction. Populated after
 * the direction is verified with the route. Empty if the route, direction, or
 * the pair of them are invalid/empty. Also empty if the _stopsElement is invalid/empty.
 */
let _stops: Array<StopDataObj> = [];

/**
 * The timepoint departures retrived using the provided Route Direction and Stop.
 * This will be an array of key-value pair objects. Most importatnly the 'Acutal'
 * and 'DepartureText' values
 */
let _timepointDepartures: Array<TimepointDepartureObj> = [];

let _outputMainDiv: HTMLDivElement;

let _outputSecondDiv: HTMLDivElement;

/**
 * Base url for all GET requests.
 */
const _url: string = "https://svc.metrotransit.org/NexTrip";

const _getRoutes: string = "/Routes";
const _getDirections: string = "/Directions/"; // {ROUTE}
const _getStops: string = "/Stops/"; //{ROUTE}/{DIRECTION}
const _getTimepointDepartures: string = "/"; //{ROUTE}/{DIRECTION}/{STOP}

function validateAndSetCode(control: ControlOptions, errorMsg: string, codeValidCallback?: Function) {
    let code = _controls[control].parseCode();
    if (_controls[control].element.value != "" && code === "") {
        _controls[control].code = "";
        setValidation(control, errorMsg);
    } else {
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

function setValidation(control: ValidationOptions, message: string) {
    _controls[control].validationElement.innerHTML = message;
    if (message != "") {
        _controls[control].element.classList.add("invalidInput");
    } else {
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
    
    let xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (
            this.status === 0 || (this.status >= 200 && this.status < 300))) {

            let directions: Array<DirectionDataObj> = JSON.parse(this.response);

            let isValid = false;
            directions.forEach(function (direction) {
                if (direction.Value === _controls.Direction.code) {
                    isValid = true;
                }
            });

            if (!isValid) {
                _controls.Direction.code = "";
                setValidation("Direction", "Direction not valid for Route");
            } else {
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
        return
    }
    populateTimepointDeparture();
}

/**
 * Retrieves the code corresponding to the route name. "" if the route does not exist.
 * @returns The code for the route, or "" of no route exists
 */
function getRouteCode(): string {

    let targetRoute = _controls.Route.element.value.toLowerCase();
    let routeCode: string = "";
    let possibleRoutes: Array<RouteDataObj> = [];
    _routes.forEach(function (route) {
        if (route.Description.indexOf(targetRoute) != -1) {
            possibleRoutes.push(route);
        }
    });

    if (possibleRoutes.length === 1) {
        routeCode = possibleRoutes[0].Route
    }

    return routeCode;
}

/**
 * Retrieves the code corresponding to the direction in _directions
 * @returns The code corresponding to the direction, or "" if invalid direction
 */
function getDirectionCode(): string {

    let targetDirection: string = "";

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

    let directionCode: string = "";
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
function getStopCode(): string {

    let targetStop = _controls.Stop.element.value.toLowerCase();
    let stopCode: string = "";
    let possibleStops: Array<StopDataObj> = [];
    _stops.forEach(function (stp) {
        if (stp.Text.indexOf(targetStop) != -1) {
            possibleStops.push(stp);
        }
    });

    if (possibleStops.length === 1) {
        stopCode = possibleStops[0].Value
    }

    return stopCode;
}

function getRouteName(): string {
    let routeName: string = "";
    _routes.forEach(function (route) {
        if (_controls.Route.code === route.Route) {
            routeName = route.Description;
        }
    });

    return routeName.toUpperCase();
}

function getDirectionName(): string {
    let directionName: string = "";
    _directions.forEach(function (direction) {
        if (_controls.Direction.code === direction.Value) {
            directionName = direction.Text;
        }
    });

    return directionName;
}

function getStopName(): string {
    let stopName: string = "";
    _stops.forEach(function (stp) {
        if (_controls.Stop.code === stp.Value) {
            stopName = stp.Text;
        }
    });

    return stopName.toUpperCase();
}

function displayResponse() {
    let outputMain: string = "";
    let outputSecond: string = "";
    //Should check if Actual and DepartureText have values.
    if (_timepointDepartures && _timepointDepartures.length > 0) {

        let timeUntilArrival: string | number = "";
        let busTimeRaw: string = _timepointDepartures[0].DepartureText;
        if (_timepointDepartures[0].Actual) {
            timeUntilArrival = busTimeRaw.substring(0, busTimeRaw.length - 4);
            if (timeUntilArrival === "") {
                timeUntilArrival = "0";
            }
        } else {
            let today: Date = new Date();
            let busTimeSplit: string[] = busTimeRaw.split(":");
            let busDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(busTimeSplit[0]), parseInt(busTimeSplit[1]));
            timeUntilArrival = new Date(busDateTime.getTime() - today.getTime()).getMinutes();
        }

        outputMain = timeUntilArrival + " minutes";
        outputSecond = "The next " + getDirectionName() + " bus on route " + getRouteName() + " will arrive at " + getStopName() + " in " + timeUntilArrival + " minutes";

    } else {
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

    let xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (
            this.status === 0 || (this.status >= 200 && this.status < 300))) {

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

    let xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (
            this.status === 0 || (this.status >= 200 && this.status < 300))) {

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

function populateDirections(callback?: Function) {

    if (_controls.Route.code === "") {
        return;
    }

    let xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (
            this.status === 0 || (this.status >= 200 && this.status < 300))) {

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

    let xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState === XMLHttpRequest.DONE && (
            this.status === 0 || (this.status >= 200 && this.status < 300))) {

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

    _controls.Route.element = document.getElementById("Route") as HTMLInputElement;
    _controls.Route.validationElement = document.getElementById("RouteValidation") as HTMLSpanElement;

    _controls.Direction.element = document.getElementById("Direction") as HTMLInputElement;
    _controls.Direction.validationElement = document.getElementById("DirectionValidation") as HTMLSpanElement;

    _controls.Stop.element = document.getElementById("Stop") as HTMLInputElement;
    _controls.Stop.validationElement = document.getElementById("StopValidation") as HTMLSpanElement;

    _controls.Enter.element = document.getElementById("EnterBtn") as HTMLButtonElement;
    _controls.Enter.validationElement = document.getElementById("EnterValidation") as HTMLSpanElement;

    _outputMainDiv = document.getElementById("OutputMain") as HTMLDivElement;
    _outputSecondDiv = document.getElementById("OutputSecond") as HTMLDivElement;

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
    } else {
    }
}

function init() {
    populateRoutes();
    populateDOMElementVariables();
}

window.onload = function () {
    init();
};
