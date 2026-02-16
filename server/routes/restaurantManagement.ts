import { Router } from "express";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { insertRestaurantSchema, insertRestaurantEmployeeSchema, insertRestaurantTableSchema } from "../../shared/schema";
import { validateQRCodeHash, generateQRCodeUrl } from "../../shared/qrCodeUtils";

const router = Router();

// Helper function to check MongoDB connection
const checkMongoConnection = () => {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB not connected');
  }
  return mongoose.connection.db;
};

// Restaurant CRUD operations
router.get("/api/admin/restaurants", async (req, res) => {
  try {
    const db = checkMongoConnection();
    const restaurants = await db.collection("restaurants").find({}).toArray();
    res.json(restaurants);
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

router.get("/api/admin/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await checkMongoConnection().collection("restaurants").findOne({ _id: new ObjectId(id) });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json(restaurant);
  } catch (error) {
    console.error("Error fetching restaurant:", error);
    res.status(500).json({ error: "Failed to fetch restaurant" });
  }
});

router.post("/api/admin/restaurants", async (req, res) => {
  try {
    const validatedData = insertRestaurantSchema.parse(req.body);

    const restaurant = {
      ...validatedData,
      _id: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await checkMongoConnection().collection("restaurants").insertOne(restaurant);
    res.status(201).json(restaurant);
  } catch (error: any) {
    console.error("Error creating restaurant:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create restaurant" });
  }
});

router.put("/api/admin/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertRestaurantSchema.parse(req.body);

    const updateData = {
      ...validatedData,
      updatedAt: new Date()
    };

    const result = await checkMongoConnection().collection("restaurants").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const updatedRestaurant = await checkMongoConnection().collection("restaurants").findOne({ _id: new ObjectId(id) });
    res.json(updatedRestaurant);
  } catch (error: any) {
    console.error("Error updating restaurant:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update restaurant" });
  }
});

router.delete("/api/admin/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if restaurant has employees or tables
    const employeeCount = await checkMongoConnection().collection("restaurantEmployees").countDocuments({ restaurantId: id });
    const tableCount = await checkMongoConnection().collection("restaurantTables").countDocuments({ restaurantId: id });

    if (employeeCount > 0 || tableCount > 0) {
      return res.status(400).json({
        error: "Cannot delete restaurant with existing employees or tables",
        employeeCount,
        tableCount
      });
    }

    const result = await checkMongoConnection().collection("restaurants").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json({ message: "Restaurant deleted successfully" });
  } catch (error) {
    console.error("Error deleting restaurant:", error);
    res.status(500).json({ error: "Failed to delete restaurant" });
  }
});

// GET employees by restaurant ID
router.get("/api/admin/restaurants/:restaurantId/employees", async (req, res) => {
  try {
    const db = checkMongoConnection();
    const { restaurantId } = req.params;
    const employees = await db.collection("restaurantEmployees").find({ restaurantId }).toArray();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching restaurant employees:", error);
    res.status(500).json({ error: "Failed to fetch restaurant employees" });
  }
});

// GET tables by restaurant ID
router.get("/api/admin/restaurants/:restaurantId/tables", async (req, res) => {
  try {
    const db = checkMongoConnection();
    const { restaurantId } = req.params;
    const tables = await db.collection("restaurantTables").find({ restaurantId }).toArray();
    res.json(tables);
  } catch (error) {
    console.error("Error fetching restaurant tables:", error);
    res.status(500).json({ error: "Failed to fetch restaurant tables" });
  }
});

// Employee CRUD operations
router.get("/api/admin/employees", async (req, res) => {
  try {
    const employees = await checkMongoConnection().collection("restaurantEmployees").find({}).toArray();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

router.get("/api/admin/restaurants/:restaurantId/employees", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const employees = await checkMongoConnection().collection("restaurantEmployees").find({ restaurantId }).toArray();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching restaurant employees:", error);
    res.status(500).json({ error: "Failed to fetch restaurant employees" });
  }
});

router.get("/api/admin/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await checkMongoConnection().collection("restaurantEmployees").findOne({ _id: new ObjectId(id) });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

router.post("/api/admin/employees", async (req, res) => {
  try {
    // Convert hireDate string to Date object if it exists
    const dataToValidate = {
      ...req.body,
      hireDate: req.body.hireDate ? new Date(req.body.hireDate) : undefined
    };

    const validatedData = insertRestaurantEmployeeSchema.parse(dataToValidate);

    const employee = {
      ...validatedData,
      _id: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await checkMongoConnection().collection("restaurantEmployees").insertOne(employee);
    res.status(201).json(employee);
  } catch (error: any) {
    console.error("Error creating employee:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create employee" });
  }
});

router.put("/api/admin/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Convert hireDate string to Date object if it exists
    const dataToValidate = {
      ...req.body,
      hireDate: req.body.hireDate ? new Date(req.body.hireDate) : undefined
    };

    const validatedData = insertRestaurantEmployeeSchema.parse(dataToValidate);

    const updateData = {
      ...validatedData,
      updatedAt: new Date()
    };

    const result = await checkMongoConnection().collection("restaurantEmployees").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const updatedEmployee = await checkMongoConnection().collection("restaurantEmployees").findOne({ _id: new ObjectId(id) });
    res.json(updatedEmployee);
  } catch (error: any) {
    console.error("Error updating employee:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update employee" });
  }
});

router.delete("/api/admin/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee is assigned to any tables
    const assignedTables = await checkMongoConnection().collection("restaurantTables").find({
      $or: [
        { assignedWaiter: id },
        { assignedHost: id }
      ]
    }).toArray();

    if (assignedTables.length > 0) {
      return res.status(400).json({
        error: "Cannot delete employee assigned to tables",
        assignedTables: assignedTables.map(t => t.tableNumber)
      });
    }

    const result = await checkMongoConnection().collection("restaurantEmployees").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

// Table CRUD operations
router.get("/api/admin/tables", async (req, res) => {
  try {
    const tables = await checkMongoConnection().collection("restaurantTables").find({}).toArray();
    res.json(tables);
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});

router.get("/api/admin/restaurants/:restaurantId/tables", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const tables = await checkMongoConnection().collection("restaurantTables").find({ restaurantId }).toArray();
    res.json(tables);
  } catch (error) {
    console.error("Error fetching restaurant tables:", error);
    res.status(500).json({ error: "Failed to fetch restaurant tables" });
  }
});

router.get("/api/admin/tables/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const table = await checkMongoConnection().collection("restaurantTables").findOne({ _id: new ObjectId(id) });

    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json(table);
  } catch (error) {
    console.error("Error fetching table:", error);
    res.status(500).json({ error: "Failed to fetch table" });
  }
});

router.post("/api/admin/tables", async (req, res) => {
  try {
    const validatedData = insertRestaurantTableSchema.parse(req.body);

    // Check if table number already exists in the restaurant
    const existingTable = await checkMongoConnection().collection("restaurantTables").findOne({
      restaurantId: validatedData.restaurantId,
      tableNumber: validatedData.tableNumber
    });

    if (existingTable) {
      return res.status(400).json({ error: "Table number already exists in this restaurant" });
    }

    const table = {
      ...validatedData,
      _id: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await checkMongoConnection().collection("restaurantTables").insertOne(table);
    res.status(201).json(table);
  } catch (error: any) {
    console.error("Error creating table:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create table" });
  }
});

router.put("/api/admin/tables/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertRestaurantTableSchema.parse(req.body);

    // Check if table number already exists in the restaurant (excluding current table)
    const existingTable = await checkMongoConnection().collection("restaurantTables").findOne({
      restaurantId: validatedData.restaurantId,
      tableNumber: validatedData.tableNumber,
      _id: { $ne: new ObjectId(id) }
    });

    if (existingTable) {
      return res.status(400).json({ error: "Table number already exists in this restaurant" });
    }

    const updateData = {
      ...validatedData,
      updatedAt: new Date()
    };

    const result = await checkMongoConnection().collection("restaurantTables").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    const updatedTable = await checkMongoConnection().collection("restaurantTables").findOne({ _id: new ObjectId(id) });
    res.json(updatedTable);
  } catch (error: any) {
    console.error("Error updating table:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update table" });
  }
});

router.delete("/api/admin/tables/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await checkMongoConnection().collection("restaurantTables").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json({ message: "Table deleted successfully" });
  } catch (error) {
    console.error("Error deleting table:", error);
    res.status(500).json({ error: "Failed to delete table" });
  }
});

// Dashboard statistics
router.get("/api/admin/restaurant-stats", async (req, res) => {
  try {
    const totalRestaurants = await checkMongoConnection().collection("restaurants").countDocuments();
    const activeRestaurants = await checkMongoConnection().collection("restaurants").countDocuments({ isActive: true });
    const totalEmployees = await checkMongoConnection().collection("restaurantEmployees").countDocuments();
    const activeEmployees = await checkMongoConnection().collection("restaurantEmployees").countDocuments({ isActive: true });
    const totalTables = await checkMongoConnection().collection("restaurantTables").countDocuments();
    const availableTables = await checkMongoConnection().collection("restaurantTables").countDocuments({ status: "available" });

    res.json({
      totalRestaurants,
      activeRestaurants,
      totalEmployees,
      activeEmployees,
      totalTables,
      availableTables
    });
  } catch (error) {
    console.error("Error fetching restaurant stats:", error);
    res.status(500).json({ error: "Failed to fetch restaurant statistics" });
  }
});

// Table access endpoint for QR code validation
router.get('/api/table-access/:restaurantId/:tableNumber/:hash', async (req, res) => {
  try {
    if (!checkMongoConnection()) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { restaurantId, tableNumber, hash } = req.params;

    // Find the restaurant
    const restaurant = await checkMongoConnection().collection('restaurants').findOne({
      _id: new ObjectId(restaurantId)
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Find the table
    const table = await checkMongoConnection().collection('restaurantTables').findOne({
      restaurantId,
      tableNumber
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Validate the QR code hash
    const hashValidation = validateQRCodeHash(restaurantId, tableNumber, hash);
    if (!hashValidation.isValid) {
      return res.status(403).json({
        error: 'Invalid QR code',
        details: hashValidation.error
      });
    }

    // Return table access data
    res.json({
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        address: restaurant.address,
        contactNumber: restaurant.contactNumber,
        operatingHours: restaurant.operatingHours || { open: "09:00", close: "22:00" }
      },
      table: {
        id: table._id.toString(),
        tableNumber: table.tableNumber,
        floor: table.floor,
        location: table.location,
        seatingCapacity: table.seatingCapacity,
        tableType: table.tableType,
        status: table.status,
        specialFeatures: table.specialFeatures || []
      },
      isValid: true
    });
  } catch (error) {
    console.error('Error validating table access:', error);
    res.status(500).json({ error: 'Failed to validate table access' });
  }
});

// Generate QR code URL with secure hash
router.post('/api/admin/generate-qr-code', async (req, res) => {
  try {
    const { restaurantId, tableNumber, baseUrl } = req.body;

    if (!restaurantId || !tableNumber || !baseUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify that the restaurant exists
    const restaurant = await checkMongoConnection().collection('restaurants').findOne({
      _id: new ObjectId(restaurantId)
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Generate the QR code URL with secure hash
    const qrCodeUrl = generateQRCodeUrl(baseUrl, restaurantId, tableNumber);

    res.json({ qrCodeUrl });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

export default router;
