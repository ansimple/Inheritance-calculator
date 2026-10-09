/**
 * Zero-loss Fractional Precision Arithmetic Engine using native BigInt.
 * Prevents floating-point rounding errors in statutory share (e.g. 1.5 : 1.0 => 3/7, 2/7)
 * and legal reserve calculations (1/2, 1/3).
 */
export class BigFraction {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(num: bigint | number | string, den: bigint | number | string = 1n) {
    let n = BigInt(num);
    let d = BigInt(den);
    if (d === 0n) {
      throw new Error("Denominator cannot be zero");
    }
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const gcdVal = BigFraction.gcd(n < 0n ? -n : n, d);
    this.numerator = n / gcdVal;
    this.denominator = d / gcdVal;
  }

  static gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  add(other: BigFraction): BigFraction {
    const num = this.numerator * other.denominator + other.numerator * this.denominator;
    const den = this.denominator * other.denominator;
    return new BigFraction(num, den);
  }

  sub(other: BigFraction): BigFraction {
    const num = this.numerator * other.denominator - other.numerator * this.denominator;
    const den = this.denominator * other.denominator;
    return new BigFraction(num, den);
  }

  mul(other: BigFraction): BigFraction {
    return new BigFraction(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  multiply(other: BigFraction | bigint | number, den: bigint | number = 1n): BigFraction {
    if (other instanceof BigFraction) {
      return this.mul(other);
    }
    return this.mul(new BigFraction(other, den));
  }

  div(other: BigFraction): BigFraction {
    if (other.numerator === 0n) {
      throw new Error("Division by zero fraction");
    }
    return new BigFraction(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  toNumber(): number {
    return Number(this.numerator) / Number(this.denominator);
  }

  compare(other: BigFraction): number {
    const diff = this.numerator * other.denominator - other.numerator * this.denominator;
    if (diff > 0n) return 1;
    if (diff < 0n) return -1;
    return 0;
  }

  isZero(): boolean {
    return this.numerator === 0n;
  }

  isPositive(): boolean {
    return this.numerator > 0n;
  }

  isNegative(): boolean {
    return this.numerator < 0n;
  }

  toFractionString(): string {
    if (this.denominator === 1n) return `${this.numerator}`;
    return `${this.numerator}/${this.denominator}`;
  }

  toDecimalString(fractionDigits: number = 6): string {
    const isNeg = this.numerator < 0n;
    const absNum = isNeg ? -this.numerator : this.numerator;
    const intPart = absNum / this.denominator;
    let remainder = absNum % this.denominator;
    let decStr = "";
    for (let i = 0; i < fractionDigits; i++) {
      remainder *= 10n;
      decStr += (remainder / this.denominator).toString();
      remainder %= this.denominator;
    }
    return `${isNeg ? "-" : ""}${intPart}.${decStr}`;
  }

  toJSON(): { n: string; d: string } {
    return {
      n: this.numerator.toString(),
      d: this.denominator.toString(),
    };
  }

  static fromJSON(json: { n: string; d: string }): BigFraction {
    return new BigFraction(BigInt(json.n), BigInt(json.d));
  }
}
