const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },

        description: {
            type: String,
            required: true
        },

        price: {
            type: Number,
            required: [true, "Selling price is required"],
            min: [0.01, "Selling price must be greater than 0"]
        },

        mrp: {
            type: Number,
            default: null,
            validate: {
                validator: function (val) {
                    if (val === null || val === undefined) return true;
                    if (typeof val !== 'number' || isNaN(val) || val <= 0) return false;
                    if (typeof this.price === 'number' && val < this.price) return false;
                    return true;
                },
                message: "MRP must be a positive number and cannot be less than selling price"
            }
        },

        category: {
            type: String,
            required: true
        },

        image: {
            type: String,
            required: true
        },

        images: {
            type: [String],
            default: []
        },

        colors: {
            type: [String],
            default: []
        },

        colorVariants: [
            {
                colorName: {
                    type: String,
                    required: true
                },
                colorCode: {
                    type: String,
                    required: true
                },
                image: {
                    type: String,
                    required: true
                },
                images: {
                    type: [String],
                    default: []
                },
                stock: {
                    type: Number,
                    default: 0
                }
            }
        ],

        sizes: {
            type: [String],
            default: []
        },

        // Size-wise stock map e.g. { S: 0, M: 5, L: 2, XL: 0, XXL: 7 }
        sizeStock: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        stock: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// Pre-save hook to ensure overall stock always equals the sum of sizeStock or colorVariants
productSchema.pre("save", function () {
    if (this.sizeStock && typeof this.sizeStock === 'object' && Object.keys(this.sizeStock).length > 0) {
        const entries = Object.values(this.sizeStock);
        if (entries.length > 0) {
            this.stock = entries.reduce((sum, qty) => sum + (Number(qty) || 0), 0);
        }
    } else if (this.colorVariants && this.colorVariants.length > 0) {
        this.stock = this.colorVariants.reduce((sum, cv) => sum + (Number(cv.stock) || 0), 0);
    }
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;