// CSF_vLatest

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

contract SCSC {
    // Struct to hold manufacturer information
    struct Manufacturer {
        address manufacturerAddress;
        string name;
        string location;
        string registrationInfoIPFSHash;
        bool isRegistered;
        bool isConnectedToSensors; // New field to track sensor connection status
        uint256 lastReportTimestamp; // New field to track last report timestamp
        uint256 totalEmissions; // New field to track total emissions
        uint256 numReports; // New field to track number of reports
        uint256 threshold; // New field to store emission threshold
        uint256 tonsOfCementProduced;
    }

    // Struct to hold emissions report
    struct EmissionsReport {
        uint256 timestamp;
        uint256 emissions;
        string reportIPFSHash;
    }

    // Struct to hold certification information
    struct Certification {
        address manufacturerAddress;
        string name;
        string location;
        uint256 emissionsPerYear;
        uint256 tonsOfCementProducedPerYear;
        uint256 emissionFactor;
        uint256 sustainabilityScore;
        bool regulatorApproved; // New field to track regulator approval
    }

    // Address of the regulating authority
    address public immutable regulator;

    // Mapping to store manufacturers
    mapping(address => Manufacturer) public manufacturers; // Changed to private to make it only accessible to regulator 

    // Mapping to store emissions reports
    mapping(address => EmissionsReport[]) private emissionsReports;

    // Array to store certifications
    Certification[] public certifications;

    // Event to announce registration request
    event RegistrationRequested(address indexed manufacturerAddress, string indexed name, string indexed location);

    // Event to announce registration approval
    event RegistrationApproved(address indexed manufacturerAddress, string indexed name, string indexed location);

    // Event to announce sensor connection
    event SensorConnected(address indexed manufacturerAddress);

    // Event to announce violation
    event ViolationDetected(address indexed regulatorAddress, address indexed manufacturerAddress, uint256 indexed emissions);

    // Event to announce reporting cycle completion
    event ReportingCycleCompleted(address indexed manufacturerAddress, uint256 emissionsPerYear, uint256 tonsOfCementProducedPerYear, uint256 emissionFactor);

    // Event to announce certificate issuance
    event CertificateIssued(
        address indexed manufacturerAddress,
        string name,
        string location,
        uint256 totalEmissions,
        uint256 tonsOfCementProduced,
        uint256 sustainabilityScore,
        bool isApproved
    );

    // Event
    event CertificateIndex(uint256 indexed index);

    // Event to announce certificate approval
    event CertificateApproved(uint256 indexed index);

    // Modifier to ensure only regulator can perform certain actions
    modifier onlyRegulator() {
        require(msg.sender == regulator, "Only regulator can perform this action");
        _;
    }

    // Modifier to ensure manufacturer is not already registered
    modifier notRegistered() {
        require(!manufacturers[msg.sender].isRegistered, "Manufacturer is already registered");
        _;
    }

    // Modifier to ensure manufacturer is registered
    modifier registered() {
        require(manufacturers[msg.sender].isRegistered, "Manufacturer is not registered");
        _;
    }

    // Modifier to ensure manufacturer is approved
    modifier approved() {
        require(manufacturers[msg.sender].isRegistered, "Manufacturer is not approved");
        _;
    }

    // Modifier to ensure manufacturer is connected to sensors
    modifier connectedToSensors() {
        require(manufacturers[msg.sender].isConnectedToSensors, "Manufacturer is not connected to sensors");
        _;
    }

    // Constructor sets the regulator
    constructor() {
        regulator = msg.sender;
    }

    // Function for manufacturers to register
    function register(string memory _name, string memory _location, string memory _registrationInfoIPFSHash) external notRegistered {
        require(!manufacturers[msg.sender].isRegistered, "Manufacturer is already registered");
        manufacturers[msg.sender] = Manufacturer(msg.sender, _name, _location, _registrationInfoIPFSHash, false, false, 0, 0, 0, 0, 0);
        emit RegistrationRequested(msg.sender, _name, _location);
    }

    // Function for regulator to approve registration
    function approveRegistration(address _manufacturerAddress) external onlyRegulator {
        Manufacturer storage manufacturer = manufacturers[_manufacturerAddress];
        require(!manufacturer.isRegistered, "Manufacturer is already approved and registered");
        manufacturer.isRegistered = true;
        manufacturer.threshold = 1000;
        emit RegistrationApproved(manufacturer.manufacturerAddress, manufacturer.name, manufacturer.location);
    }

    // Function for manufacturers to connect sensors
    function connectSensors() external registered {
        Manufacturer storage manufacturer = manufacturers[msg.sender];
        require(!manufacturer.isConnectedToSensors, "Sensors are already connected");
        manufacturer.isConnectedToSensors = true;
        emit SensorConnected(msg.sender);
    }

    // Function for manufacturers to report emissions
    function reportEmissions(uint256 _emissions, uint256 _tonsOfCementProduced, string memory _reportIPFSHash) external registered connectedToSensors {
        Manufacturer storage manufacturer = manufacturers[msg.sender];
        EmissionsReport memory newReport = EmissionsReport(block.timestamp, _emissions, _reportIPFSHash);
        emissionsReports[msg.sender].push(newReport);
        manufacturer.lastReportTimestamp = block.timestamp;
        manufacturer.totalEmissions += _emissions;
        manufacturer.tonsOfCementProduced += _tonsOfCementProduced;
        manufacturer.numReports++;
        if (_emissions > manufacturer.threshold) {
            emit ViolationDetected(regulator, msg.sender, _emissions);
        }
    }

    // Function to calculate average emissions and emission factor
    function calculateAverageAndEmissionFactor(address _manufacturerAddress) external onlyRegulator {
        Manufacturer storage manufacturer = manufacturers[_manufacturerAddress];
        require(manufacturer.numReports > 0, "No reports available");
        
        // Calculate time elapsed since last report
        uint256 timeElapsed = 1; // block.timestamp - manufacturer.lastReportTimestamp;
        require(timeElapsed > 0, "Time since last report is zero");

        // Calculate emissions per year
        uint256 emissionsPerYear = manufacturer.totalEmissions / timeElapsed;

        // Calculate tons of cement produced per year
        uint256 tonsOfCementProducedPerYear = 0;
        if (manufacturer.tonsOfCementProduced > 0) {
            tonsOfCementProducedPerYear = manufacturer.tonsOfCementProduced / timeElapsed;
        }

        // Calculate emissions factor (emissions per ton of cement produced)
        uint256 emissionFactor = 0;
        if (tonsOfCementProducedPerYear > 0) {
            // Perform arithmetic operations with appropriate scaling
            emissionFactor = (manufacturer.totalEmissions * 100) / (tonsOfCementProducedPerYear * timeElapsed);
            // emissionFactor = (emissionsPerYear * 100) / tonsOfCementProducedPerYear; // Multiply by 100 to represent two decimal places so its a percentage %
        }

        emit ReportingCycleCompleted(_manufacturerAddress, emissionsPerYear, tonsOfCementProducedPerYear, emissionFactor);

        // // Resetting values for the next reporting cycle
        // manufacturer.totalEmissions = 0;
        // manufacturer.numReports = 0;
        // manufacturer.tonsOfCementProduced = 0;
    }

    // Function to issue certificate upon approval of audit result
    function issueCertificate(address _manufacturerAddress) external onlyRegulator {
        // Retrieve manufacturer information from the mapping
        Manufacturer storage manufacturer = manufacturers[_manufacturerAddress];
        require(manufacturer.isRegistered, "Manufacturer is not registered");

        // Calculate sustainability score using emission factor
        uint256 sustainabilityScore = manufacturer.totalEmissions / manufacturer.tonsOfCementProduced;

        // Create a new certification
        Certification memory newCertification = Certification({
            manufacturerAddress: _manufacturerAddress,
            name: manufacturer.name,
            location: manufacturer.location,
            emissionsPerYear: manufacturer.totalEmissions,
            tonsOfCementProducedPerYear: manufacturer.tonsOfCementProduced,
            emissionFactor: sustainabilityScore,
            sustainabilityScore: sustainabilityScore,
            regulatorApproved: false
        });

        // Add the certification to the array
        certifications.push(newCertification);

        // Emit event for certificate issuance along with the index
        emit CertificateIssued(
            _manufacturerAddress,
            manufacturer.name,
            manufacturer.location,
            manufacturer.totalEmissions,
            manufacturer.tonsOfCementProduced,
            sustainabilityScore,
            false // Initial status is not regulator approved
        );

        // Emit event to announce the certificate index required for approval
        emit CertificateIndex(certifications.length - 1); // Index of the newly added certificate

        // Resetting values for the next reporting cycle
        manufacturer.totalEmissions = 0;
        manufacturer.numReports = 0;
        manufacturer.tonsOfCementProduced = 0;
    }

    // Function for regulator to approve certificates
    function approveCertificate(uint256 _index) external onlyRegulator {
        require(_index < certifications.length, "Certificate index out of bounds");
        certifications[_index].regulatorApproved = true;
        emit CertificateApproved(_index);
    }

    //DEADCODE // Function to get manufacturer information (internal function, accessible only to the regulator)
    // function _getManufacturer(address _manufacturerAddress) internal view returns (Manufacturer memory) {
    //     return manufacturers[_manufacturerAddress];
    // }
}

contract AuditSC {
    // Struct to hold audit request information
    struct AuditRequest {
        address regulator;
        address manufacturer;
        address[] appliedAuditors;
        address[] acceptedAuditors;
        address acceptedAuditor; // New field to store the accepted auditor's address
        string reportIPFSHash;
        bool isCompleted;
        bool isApproved;
        bool passed;
        bool isOpen;
    }

    // Array to store audit requests
    AuditRequest[] public auditRequests;

    // Event to announce audit request along with regulator, manufacturer, and requestId
    event AuditRequestOpened(address indexed regulator, address indexed manufacturer, uint256 requestId);
    event AuditorApplied(address indexed auditor, uint256 indexed requestId);
    event AuditReportSubmitted(uint256 indexed requestId, string indexed reportIPFSHash);
    event AuditResultAvailable(uint256 indexed requestId, bool indexed passed);
    event AuditCompleted(uint256 indexed requestId, bool indexed passed);

    // Modifier to ensure only regulator can perform certain actions
    modifier onlyRegulator() {
        require(msg.sender == regulator, "Only regulator can perform this action");
        _;
    }

    // Modifier to ensure only auditors can perform certain actions
    modifier onlyAuditor() {
        require(!_isRegulator() && !_isManufacturer(), "Only auditors can perform this action");
        _;
    }

    // Modifier to ensure audit request is not completed
    modifier notCompleted(uint256 _requestId) {
        require(!auditRequests[_requestId].isCompleted, "Audit request is already completed");
        _;
    }

    // Modifier to ensure audit request is not approved
    modifier notApproved(uint256 _requestId) {
        require(!auditRequests[_requestId].isApproved, "Audit request is already approved");
        _;
    }

    // Modifier to ensure audit request is open
    modifier isOpen(uint256 _requestId) {
        require(auditRequests[_requestId].acceptedAuditors.length == 0, "Audit request is not open for applications");
        _;
    }

    // Modifier to ensure auditor is not the manufacturer
    modifier notManufacturer(address _manufacturer) {
        require(msg.sender != _manufacturer, "Auditor cannot be the manufacturer");
        _;
    }

    // Address of the regulating authority
    address public immutable regulator;

    // Constructor sets the regulator
    constructor() {
        regulator = msg.sender;
    }

    // Function to check if sender is regulator
    function _isRegulator() private view returns (bool) {
        return msg.sender == regulator;
    }

    // Function to check if sender is manufacturer
    function _isManufacturer() private view returns (bool) {
        return msg.sender == auditRequests[auditRequests.length - 1].manufacturer;
    }

    // Function for regulator to request an audit and return the request ID
    function requestAudit(address _manufacturer) external onlyRegulator returns (uint256) {
        uint256 requestId = auditRequests.length; // Generate request ID
        address[] memory emptyArray; // Initialize an empty dynamic array of addresses
        auditRequests.push(AuditRequest(regulator, _manufacturer, emptyArray, emptyArray, address(0), "", false, false, false, true)); // Set isOpen to true initially
        emit AuditRequestOpened(regulator, _manufacturer, requestId);
        return requestId;
    }

    // Function for auditors to apply for an audit request
    function applyForAudit(uint256 _requestId) external onlyAuditor notManufacturer(auditRequests[_requestId].manufacturer) {
        require(auditRequests[_requestId].isOpen, "Audit request is not open for applications");
        auditRequests[_requestId].appliedAuditors.push(msg.sender); // Change to appliedAuditors
        emit AuditorApplied(msg.sender, _requestId);
    }

    // Function for regulator to accept an auditor
    function acceptAuditor(uint256 _requestId, address _auditor) external onlyRegulator {
        require(auditRequests[_requestId].appliedAuditors.length > 0, "No auditors applied for this request");
        require(auditRequests[_requestId].isOpen, "Audit request is not open for applications");
        
        // Loop through applied auditors to find the one to accept
        for (uint256 i = 0; i < auditRequests[_requestId].appliedAuditors.length; i++) {
            if (auditRequests[_requestId].appliedAuditors[i] == _auditor) {
                auditRequests[_requestId].acceptedAuditors.push(_auditor);
                // Remove the accepted auditor from appliedAuditors
                delete auditRequests[_requestId].appliedAuditors[i];
                break;
            }
        }

        auditRequests[_requestId].isOpen = false; // Close the request for applications
    }

    // Function for auditor to submit audit report
    function submitAuditReport(uint256 _requestId, string memory _reportIPFSHash, bool _passed) external onlyAuditor {
        require(auditRequests[_requestId].acceptedAuditors.length == 1, "Audit request is not approved yet");
        require(msg.sender == auditRequests[_requestId].acceptedAuditors[0], "Only accepted auditor can submit report");
        auditRequests[_requestId].reportIPFSHash = _reportIPFSHash;
        auditRequests[_requestId].isCompleted = true;
        auditRequests[_requestId].passed = _passed;
        auditRequests[_requestId].acceptedAuditor = msg.sender; // Store the accepted auditor's address
        emit AuditReportSubmitted(_requestId, _reportIPFSHash);
        emit AuditResultAvailable(_requestId, _passed);
    }
    
    // Function for regulator to approve or reject audit results
    function approveAuditResult(uint256 _requestId, bool _approved) external onlyRegulator notApproved(_requestId) {
        require(auditRequests[_requestId].isCompleted, "Audit request is not completed yet");
        require(!auditRequests[_requestId].passed || _approved, "Cannot approve failed audit");
        auditRequests[_requestId].isApproved = true;
        emit AuditResultAvailable(_requestId, _approved);
        if (_approved) {
            emit AuditCompleted(_requestId, true);
        } else {
            // Additional logic for handling rejection, like reopening the audit request
        }
    }
}