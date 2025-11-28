const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@mongodb:27017/ticketbooking?authSource=admin';

// Middleware
app.use(cors());
app.use(express.json());

// Ticket Schema
const ticketSchema = new mongoose.Schema({
    eventName: { type: String, required: true },
    eventType: {
        type: String,
        enum: ['movie', 'concert', 'sports', 'theater', 'conference', 'other'],
        required: true
    },
    venue: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    totalSeats: { type: Number, required: true },
    availableSeats: { type: Number, required: true },
    description: String,
    imageUrl: String,
    status: {
        type: String,
        enum: ['active', 'sold-out', 'cancelled', 'completed'],
        default: 'active'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log('Connected to MongoDB');
        seedDatabase();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Seed database with sample tickets
async function seedDatabase() {
    try {
        const count = await Ticket.countDocuments();
        if (count === 0) {
            const sampleTickets = [
                {
                    eventName: 'Rock Concert 2024',
                    eventType: 'concert',
                    venue: 'Madison Square Garden',
                    date: new Date('2024-12-15'),
                    time: '20:00',
                    price: 85.00,
                    totalSeats: 500,
                    availableSeats: 500,
                    description: 'An amazing rock concert featuring top bands',
                    imageUrl: '/images/concert.jpg'
                },
                {
                    eventName: 'BlockBuster Movie Premiere',
                    eventType: 'movie',
                    venue: 'AMC Theater',
                    date: new Date('2024-11-30'),
                    time: '19:30',
                    price: 25.00,
                    totalSeats: 200,
                    availableSeats: 200,
                    description: 'Exclusive premiere of the year\'s most anticipated movie',
                    imageUrl: '/images/movie.jpg'
                },
                {
                    eventName: 'NBA Finals Game 7',
                    eventType: 'sports',
                    venue: 'Staples Center',
                    date: new Date('2024-12-20'),
                    time: '18:00',
                    price: 150.00,
                    totalSeats: 1000,
                    availableSeats: 1000,
                    description: 'Championship game - don\'t miss the action!',
                    imageUrl: '/images/sports.jpg'
                },
                {
                    eventName: 'Shakespeare\'s Hamlet',
                    eventType: 'theater',
                    venue: 'Broadway Theater',
                    date: new Date('2024-12-01'),
                    time: '19:00',
                    price: 65.00,
                    totalSeats: 300,
                    availableSeats: 300,
                    description: 'Classic theater performance',
                    imageUrl: '/images/theater.jpg'
                },
                {
                    eventName: 'Tech Summit 2024',
                    eventType: 'conference',
                    venue: 'Convention Center',
                    date: new Date('2024-12-10'),
                    time: '09:00',
                    price: 299.00,
                    totalSeats: 1500,
                    availableSeats: 1500,
                    description: 'Annual technology conference with industry leaders',
                    imageUrl: '/images/conference.jpg'
                }
            ];

            await Ticket.insertMany(sampleTickets);
            console.log('Sample tickets added to database');
        }
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ticket-service' });
});

// Get all tickets
app.get('/api/tickets', async (req, res) => {
    try {
        const { eventType, status, minPrice, maxPrice, date } = req.query;
        let filter = {};

        if (eventType) filter.eventType = eventType;
        if (status) filter.status = status;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseFloat(minPrice);
            if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
        }
        if (date) {
            const searchDate = new Date(date);
            filter.date = {
                $gte: searchDate,
                $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
            };
        }

        const tickets = await Ticket.find(filter).sort({ date: 1 });
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Error fetching tickets' });
    }
});

// Get ticket by ID
app.get('/api/tickets/:id', async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: 'Error fetching ticket' });
    }
});

// Create ticket (admin only)
app.post('/api/tickets', async (req, res) => {
    try {
        const ticket = new Ticket(req.body);
        await ticket.save();
        res.status(201).json({ message: 'Ticket created successfully', ticket });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: 'Error creating ticket' });
    }
});

// Update ticket
app.put('/api/tickets/:id', async (req, res) => {
    try {
        req.body.updatedAt = new Date();
        const ticket = await Ticket.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json({ message: 'Ticket updated successfully', ticket });
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ error: 'Error updating ticket' });
    }
});

// Reserve seats (internal use by booking service)
app.post('/api/tickets/:id/reserve', async (req, res) => {
    try {
        const { quantity } = req.body;
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        if (ticket.availableSeats < quantity) {
            return res.status(400).json({ error: 'Not enough seats available' });
        }

        ticket.availableSeats -= quantity;
        if (ticket.availableSeats === 0) {
            ticket.status = 'sold-out';
        }
        ticket.updatedAt = new Date();

        await ticket.save();
        res.json({ message: 'Seats reserved successfully', ticket });
    } catch (error) {
        console.error('Error reserving seats:', error);
        res.status(500).json({ error: 'Error reserving seats' });
    }
});

// Release seats (in case of cancellation)
app.post('/api/tickets/:id/release', async (req, res) => {
    try {
        const { quantity } = req.body;
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        ticket.availableSeats += quantity;
        if (ticket.availableSeats > 0 && ticket.status === 'sold-out') {
            ticket.status = 'active';
        }
        ticket.updatedAt = new Date();

        await ticket.save();
        res.json({ message: 'Seats released successfully', ticket });
    } catch (error) {
        console.error('Error releasing seats:', error);
        res.status(500).json({ error: 'Error releasing seats' });
    }
});

// Delete ticket
app.delete('/api/tickets/:id', async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndDelete(req.params.id);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json({ message: 'Ticket deleted successfully' });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Error deleting ticket' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Ticket service running on port ${PORT}`);
});
