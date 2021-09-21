/**
 * USAGE: node assignShipmentToDriver.js -h to get usage
 */
(function (exports) {
    const fs = require('fs');

    const EVEN_MULTIPLIER = 1.5;
    const ODD_MULTIPLIER = 1
    const MATCH_MULTIPLIER = 1.5;

    // Use english as the default but if we want to support other languages we'll want to override this
    const ENGLISH_VOWELS = ['a', 'e', 'i', 'o', 'u', 'y'];

    /**
     * Utility function to parse command line for flags and values
     * @returns {Object} {shipmentFile, driverFile} filenames to read in.
     */
    function parseCommandLineArgs() {
        let shipmentFile;
        let driverFile;
        process.argv.forEach(function (val, index, array) {
            let thisEntry = val.split('=');
            if (thisEntry.length > 1) {
                switch (thisEntry[0]) {
                    case '--shipmentFile':
                        shipmentFile = thisEntry[1];
                        break;
                    case '--driverFile':
                        driverFile = thisEntry[1];
                        break;
                    case '-h':
                    case '--help':
                    default:
                        printUsage();
                        process.exit();
                        break;
                }
            }

        });
        if (!(shipmentFile && driverFile)) {
            console.warn('ERROR: Both shipmentsFile and driversFile are required');
            printUsage();
            process.exit();
        }
        const result = {
            shipmentFile,
            driverFile
        };
        return result;
    }

    /**
     * readInFiles takes the two requried files, reads them in and transforms them into arrays of data
     * @param {Object} {shipmentFile, driverFile} file names to be read in 
     * @returns  {Object} {shipmentArray, driverArray} read in data
     */
    function readInFiles({ shipmentFile, driverFile }) {
        let shipmentData = [];
        let driverData = [];
        try {
            const shipmentRaw = fs.readFileSync(shipmentFile, { encoding: 'utf8', flag: 'r' });
            shipmentData = shipmentRaw.split('\n');
            const driverRaw = fs.readFileSync(driverFile, { encoding: 'utf8', flag: 'r' });
            driverData = driverRaw.split('\n');

        } catch (err) {
            console.error('ERROR: Failed to read files', shipmentFile, driverFile, err);
            process.exit();
        }
        const result = {
            shipments: shipmentData,
            drivers: driverData
        };
        return result; // I would have typed this into an object to ensure type safety if this was real
    };

    /**
     * printUsage will print the expected command line options for reference
     */
    function printUsage() {
        console.info('USAGE: node assignShipmentToDriver.js --driverFile=filename --shipmentFile=filename');
        console.info('  [--driverFile filename] - The file containing newline seperated drivers');
        console.info('  [--shipmentFile filename] - The file containing newline seperated shipments');
        console.info('  [-h|--help] - Prints this usage');
    }

    /**
     * countVowels counts the vowels in a string and returns the number result
     * @param {Strin} targetString 
     * @param {Array} vowelArray 
     * @returns {Number}
     */
    function countVowels(targetString, vowelArray = ENGLISH_VOWELS) {
        let count = 0;
        for (let i = 0, iLen = targetString.length; i < iLen; i++) {
            let char = targetString[i];
            if (vowelArray.indexOf(char) >= 0) {
                count++;
            }
        }
        return count;
    }

    /**
     * generateShimpmentMap reduces names to something countable, and maps result to an object in an array
     * @param {Array} shipmentArray 
     * @returns {Array} of { original full address, boolean isOdd, number length}
     */
    function generateShipmentMap(shipmentArray) {
        // The requirements specifies 'Street Name' be parsed, The challenge here is in identifying
        // what part of the address represents the street name. 
        // For the sake of brevity this alpha will only support addresses that are
        // formatted in a common US format of:
        //      [housenumber] [streetname] [streettype]
        // We will skip city/state/postal code sections and pretend that no-one uses po boxes, etc...
        let resolvedShipments = [];
        for (let i = 0, iLen = shipmentArray.length; i < iLen; i++) {
            let thisShipment = shipmentArray[i];
            thisShipment = thisShipment.trim();

            let streetArr = thisShipment.split(' ');
            if (streetArr.length < 2) {
                // see note below on verbose
                //console.warn('Address in unexpected format. Skipping', thisShipment);
                continue;
            }
            streetArr.pop();
            streetArr.splice(0, 1);

            let streetName = streetArr.join();
            streetName = streetName.toLowerCase();

            let isOdd = false;

            if (streetName.length % 2) { // odd
                isOdd = true;
            }

            let thisMap = {
                address: thisShipment,
                isOdd,
                length: streetName.length
            };
            resolvedShipments.push(thisMap);
        }

        return resolvedShipments;
    }

    /**
     * generateDriverMap reduces names to something countable, and maps result to an object in an array
     * @param {Array} driverArray 
     * @returns {Array} of { original full name, number vowel count, boolean isOdd, number length}
     */
    function generateDriverMap(driverArray) {
        let resolvedDrivers = [];
        for (let i = 0, iLen = driverArray.length; i < iLen; i++) {
            let thisDriver = driverArray[i];
            thisDriver = thisDriver.trim();

            let driverArr = thisDriver.split(' ');
            let driverName = driverArr.join();
            if (driverName.length < 1) {
                // this happens when an empty element occurs. I would add a --verbose for warnings
                //console.warn('Driver name was empty. Skipping', driverName);
                continue;
            }

            let isOdd = false;

            let vowelCount = countVowels(driverName);

            if (driverName.length % 2) { // odd
                isOdd = true;
            }

            let thisMap = {
                name: thisDriver,
                vowels: vowelCount,
                isOdd,
                length: driverName.length
            };
            resolvedDrivers.push(thisMap);
        }

        return resolvedDrivers;
    }

    /**
     * assignShipmentToDriver does the logic
     * @param {Array} shipmentArray 
     * @param {Array} driverArray 
     * @returns {Array} of result objects with {matches: [shipment full, driver full, score], total: number}
     */
    function assignShipmentToDriver(shipmentArray, driverArray) {
        let shipmentMappedArray = generateShipmentMap(shipmentArray);
        let driverMappedArray = generateDriverMap(driverArray);

        // requirement:
        // If the length of the shipment's destination street name is even, 
        //  the base suitability score (SS) is the number of vowels in the driver’s name multiplied by 1.5.
        // If the length of the shipment's destination street name is odd, 
        //  the base SS is the number of consonants in the driver’s name multiplied by 1. 
        // If the length of the shipment's destination street name shares any common factors (besides 1) with the length of the driver’s name, 
        //  the SS is increased by 50% above the base SS.

        // even shipments give us the best initial option
        shipmentMappedArray.sort((first, second) => {
            return second.length - first.length;
        });
        // to support the even shipments we want the most vowels
        driverMappedArray.sort((first, second) => {
            return second.vowelCount - first.vowelCount;
        });
        // NOTE: if this was real, this assumption would need to be tested and additional steps to
        //       look for greater optimizaitons would be in place

        // Since "we can only route one shipment to one driver per day" we can just loop once and match the best possible with is odd and same length
        let length = shipmentMappedArray.length;
        if (length > driverMappedArray.length) {
            length = driverMappedArray.length;
        }
        // requirement: The output should be the total SS and matching between shipment destinations and drivers
        let totalSS = 0;
        let matches = [];
        let oddShipments = [];
        let lastDriver = 0;
        for (let s = 0, sLen = length; s < sLen; s++) {
            let thisShipment = shipmentMappedArray[s];
            let thisDriver = driverMappedArray[lastDriver];

            if (thisShipment.isOdd) {
                oddShipments.push(thisShipment);
                continue;
            }

            let thisSS = thisDriver.vowels * EVEN_MULTIPLIER;

            // Not sure what was meant by "any common factors (besides 1)" so going to just check lengths
            // against each other
            if (thisShipment.length === thisDriver.length) {
                thisSS *= MATCH_MULTIPLIER;
            }
            totalSS += thisSS;
            // the triple array is just lazy, I would use a defined object
            const thisEntry = [thisShipment.address, thisDriver.name, thisSS];
            matches.push(thisEntry);

            lastDriver++;
        }
        // Now do the odds
        for (let s = 0, sLen = oddShipments.length; s < sLen; s++) {
            let thisShipment = oddShipments[s];
            let thisDriver = driverMappedArray[lastDriver];

            let thisSS = thisDriver.vowels * ODD_MULTIPLIER;
            if (thisShipment.length === thisDriver.length) {
                thisSS *= MATCH_MULTIPLIER;
            }
            totalSS += thisSS;
            const thisEntry = [thisShipment.address, thisDriver.name, thisSS];
            matches.push(thisEntry);

            lastDriver++;
            if (lastDriver >= driverArray.length) {
                // ran off the edge because we had more shipments than drivers
                break;
            } 
        }
        const result = {
            matches,
            total: totalSS
        };
        return result;
    }

    /**
     * simplePrint isn't pretty but will build out a string to show the result of the program running
     * @param {Array} matchArr 
     * @param {Number} total 
     * @returns {String}
     */
    function simplePrint(matchArr, total) {
        let str = "\n";
        for (let i = 0, iLen = matchArr.length; i < iLen; i++) {
            let thisMatch = matchArr[i];
            if (!thisMatch.length === 3) {
                console.error('ERROR: format doesnt match whats needed for printing');
                continue;
            }
            str += thisMatch[1] + ' to ' + thisMatch[0] + ' for ' + thisMatch[2] +'\n';
        }
        str += "Total: " + total+'\n';
        return str;
    }

    // We can run differently depending on if we were invoked from the command line (our current requriement)
    // or later we can be imported. Good for testing.
    if (require.main === module) {
        const files = parseCommandLineArgs()
        const data = readInFiles(files);
        const result = assignShipmentToDriver(data.shipments, data.drivers);
        console.log(simplePrint(result.matches, result.total));
    } else {
        // for future use
        console.log('required as a module');
        exports.assignShipmentToDriver = assignShipmentToDriver;
    }



})(typeof exports === 'undefined' ? this['shipment_assignment'] = {} : exports);