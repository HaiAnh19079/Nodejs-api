const Order = require("../models/Order");
const Product = require("../models/Product");
const ErrorHandler = require("../utils/errorhandler");

class OrderController {

    // [POST] /api/orders/newOrders
    async newOrder(req, res, next) {
        const {
            shipping_info,
            orderItems,
            paymentMethod,
            // itemsPrice,
            taxPrice,
            shippingPrice,
        } = req.body;

        if (!req.user.id) {
            res.status(400).json({
                success: false,
                message: 'You must be logged in to purchase'
            })
        }
        var itemsPrice = orderItems.reduce((prices, item) => {
            return prices += item.price * item.quantity;
        }, 0)
        console.log(itemsPrice)
        var totalPrice = itemsPrice + taxPrice + shippingPrice;
        console.log(taxPrice)
        const today = new Date()
        console.log("today => ", today)
        let three_days_later = new Date()
        three_days_later.setDate(today.getDate() + 3)
        const order = await Order.create({
            shipping_info,
            orderItems,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            expected_deliveredAt: three_days_later,
            user: req.user.id,
        });

        res.status(201).json({
            success: true,
            order,
        });
    }

    // [GET] /api/orders --> admin
    async getAllOrders(req, res, next) {
        const ordersCount = await Order.countDocuments()
        const resultPerPage = parseInt(req.query.limit || 5);
        const currentPage = parseInt(req.query.page || 1);
        const skip = resultPerPage * (currentPage - 1);

        const options = req.query.orderStatus ? {
            orderStatus: {
                $regex: req.query.orderStatus,
                $options: "i"
            }
        } : {};
        const orders = await Order.find(options)
            .limit(resultPerPage)
            .skip(skip)
        if (!req.user.role) return next(new ErrorHandler("you not allowed to get all orders!!!", 401));

        if (!orders) {
            res.status(404).json({
                success: false,
                message: "orders not found!"
            })
        }
        const totalDocuments = await Order.countDocuments();
        const totalPage = Math.ceil(totalDocuments / resultPerPage);
        res.status(200).json({
            success: true,
            ordersCount,
            orders,
            data: {
                currentPage,
                resultPerPage,
                totalDocuments,
                totalPage,
            }
        })


    }

    // [GET] /api/orders/me --> user
    async getMyOrders(req, res, next) {

        const resultPerPage = parseInt(req.query.limit || 5);
        const currentPage = parseInt(req.query.page || 1);
        const skip = resultPerPage * (currentPage - 1);

        let user = req.user;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'user not found !!',
            });
        }
        const options = req.query.orderStatus ? {
            user: user.id,
            orderStatus: {
                $regex: req.query.orderStatus,
                $options: "i"
            }
        } : { user: user.id };

        const orders = await Order.find(options)
            .limit(resultPerPage)
            .skip(skip)
        console.log(orders);
        const orderCount = orders.length;
        const totalDocuments = await Order.countDocuments();
        const totalPage = Math.ceil(totalDocuments / resultPerPage);
        res.status(200).json({
            success: true,
            orderCount,
            orders,
            data: {
                currentPage,
                resultPerPage,
                totalDocuments,
                totalPage,
            }
        });

    }

    // [GET] /api/orders/:id
    async getOrderById(req, res, next) {
        const order = await Order.findById(req.params.id);

        if (!req.user.role) return next(new ErrorHandler("you not allowed to get order!!!", 401))

        if (!order) {
            res.status(404).json({
                success: false,
                message: "Order not found!"
            })
        }

        res.status(200).json({
            success: true,
            order
        })
    }

    // [PUT] /api/orders/:id/updateOrderStatus --> admin
    async updateOrderStatus(req, res, next) {
        const order = await Order.findById(req.params.id);
        //processing , confirmed , shipping , delivered , canceled
        if (!order) {
            return next(new ErrorHandler("Order not found with this id", 404));
        }
        var result
        const orderStatusUpdate = req.body.orderStatus;

        console.log(orderStatusUpdate)

        if (order.orderStatus === orderStatusUpdate) {
            res.status(400).json({
                success: false,
                message: 'The updated status of the order must be different from the current status!'
            })
        }
        if (order.orderStatus === "Delivered") {
            return next(new ErrorHandler(`You have already delivered this order at ${order.deliveredAt}`, 400));
        }
        if (orderStatusUpdate === "Shipping") {
            console.log("order.orderItems:", order.orderItems)
                // order.orderItems.forEach(async(ord) => {
                //     console.log("ord:", ord)
                //     result = await updateStock(ord.product, ord.quantity);
                //     console.log("result:", result);

            // });
            for (var item of order.orderItems) {
                console.log("item:", item);
                await updateStock(item.product, item.quantity);
            }
        }

        if (orderStatusUpdate === "Canceled") {
            order.canceledAt = Date.now();
        }

        order.orderStatus = orderStatusUpdate;

        if (orderStatusUpdate === "Delivered") {
            order.deliveredAt = Date.now();
        }

        await order.save({ validateBeforeSave: false });
        res.status(200).json({
            success: true,
            order,
            result
        });
    }
}
async function updateStock(id, quantity) {
    const product = await Product.findById(id);
    console.log("id:", id)
    console.log("quantity:", quantity)
    console.log("product.stock before:", product.stock)
    product.stock -= quantity;
    console.log("product.stock after:", product.stock)

    await product.save({ validateBeforeSave: false });
}
module.exports = new OrderController;