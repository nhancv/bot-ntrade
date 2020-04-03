/**
 * Return round as floor
 * precisionFloorRound(0.9999999999, 8)
 * => 0.99999999
 * @param {*} number
 * @param {*} precision
 */
function precisionFloorRound(number, precision) {
  const factor = Math.pow(10, precision);
  return Math.floor(number * factor) / factor;
}


/**
 * Return round as floor
 * precisionCeilRound(0.9999999999, 8)
 * => 1
 * @param {*} number
 * @param {*} precision
 */
function precisionCeilRound(number, precision) {
  let factor = Math.pow(10, precision);
  return Math.ceil(number * factor) / factor
}

/**
 * * console.log(precise(0.0003989));
 * // expected output: "0.000399"
 * @param number
 * @param precision
 */
function precisionRound(number, precision) {
  let factor = Math.pow(10, precision);
  return Math.round(Number((number * factor).toPrecision(precision))) / factor;
}

/**
 * Input '0.00000010' => 1
 * @param numberStr: string
 */
function countZeroSuffix(numberStr) {
  let i = numberStr.length - 1;
  for (; i >= 0 && numberStr.charAt(i) != '1'; i--) ;
  return numberStr.length - 1 - i;
}

export {
  precisionFloorRound,
  precisionCeilRound,
  precisionRound,
  countZeroSuffix
};
