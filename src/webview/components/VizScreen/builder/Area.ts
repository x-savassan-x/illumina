export class Area {
    public readonly width: number;
    public readonly depth: number;
    public readonly center: { x: number; z: number };

    public constructor(
        public readonly x0: number,
        public readonly z0: number,
        public readonly x1: number,
        public readonly z1: number
    ) {
        this.width = x1 - x0;
        this.depth = z1 - z0;
        this.center = {
            x: x0 + this.width / 2,
            z: z0 + this.depth / 2
        };
    }

    public static fromSide(side: number): Area {
        return new Area(0, 0, side, side);
    }
}
