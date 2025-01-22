export const parseIntArray = (array: any[], filePath: string): string[] => {
    const arr: string[] = [];

   for (let data of array) {
        if (Array.isArray(data)) {
            for (let val of data) {
                if (Array.isArray(val)) {
                    for (let v of val) {
                        if (filePath.includes("address_size")) {
                            if (Number.isInteger(parseInt(v)) && v.toString().length >= 4) {
                                v = "*";
                            } else {
                                v = v.toString() === 'false' ? 1 : v.toString() === 'true' ? 0 : v;
                            }
                        } else {
                            v = v.toString() === 'false' ? 0 : v.toString() === 'true' ? 1 : v;
                        }
                        arr.push(v.toString());
                    }
                } else {
                    if (filePath.includes("address_size")) {
                        if (Number.isInteger(parseInt(val)) && val.toString().length >= 4) {
                            val = "*";
                        } else {
                            val = val.toString() === 'false' ? 1 : val.toString() === 'true' ? 0 : val;
                        }
                    }else {
                        val = val.toString() === 'false' ? 0 : val.toString() === 'true' ? 1 : val;
                    }
                    arr.push(val.toString());
                }
            }
        } else {
            if (filePath.includes("address_size")) {
                if (Number.isInteger(parseInt(data)) && data.toString().length >= 4) {
                    data = "*";
                } else {
                    data = data.toString() === 'false' ? 1 : data.toString() === 'true' ? 0 : data;
                }
            }else {
                data = data.toString() === 'false' ? 0 : data.toString() === 'true' ? 1 : data;
            }
            arr.push(data.toString());
        }
    }

    return arr;
}
