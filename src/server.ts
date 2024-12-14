// src/server.ts
import { connect, NatsConnection, StringCodec, Subscription } from 'nats';

class NatsServer {
    private nc!: NatsConnection;
    private sc = StringCodec();

    async start() {
        try {
            console.log('Starting NATS server...');
            
            // Connect to NATS
            this.nc = await connect({ 
                servers: 'nats://localhost:4222',
                timeout: 3000, // Connection timeout
                pingInterval: 10000, // Ping interval
                reconnect: true, // Enable reconnection
                maxReconnectAttempts: 10
            });
            
            console.log(`Connected to NATS server at ${this.nc.getServer()}`);

            // Setup subscriptions
            await this.setupSubscriptions();
            
            // Handle connection events
            this.setupConnectionHandlers();

            console.log('NATS server is ready to handle messages');
        } catch (err) {
            console.error('Failed to start NATS server:', err);
            process.exit(1);
        }
    }

    private setupConnectionHandlers() {
        this.nc.closed().then((err) => {
            if (err) {
                console.error(`NATS connection closed due to error: ${err}`);
            } else {
                console.log('NATS connection closed gracefully');
            }
        });

        // Log disconnection events
        // (async () => {
        //     for await (const status of this.nc.status()) {
        //         console.log(`NATS connection status: ${status.type}`);
        //     }
        // })().catch((err) => {
        //     console.error('Error in status handler:', err);
        // });
    }

    private async setupSubscriptions() {
        try {
            // Basic message handler
            const messageSub: Subscription = this.nc.subscribe('messages.>');
            console.log('Subscribed to "messages.>" topic');

            this.handleSubscription(messageSub, 'Message Handler');

            // User-related requests handler
            const userSub: Subscription = this.nc.subscribe('user.>');
            console.log('Subscribed to "user.>" topic');

            this.handleSubscription(userSub, 'User Handler');

        } catch (err) {
            console.error('Error setting up subscriptions:', err);
            throw err;
        }
    }

    private async handleSubscription(subscription: Subscription, handlerName: string) {
        (async () => {
            for await (const msg of subscription) {
                try {
                    
                    console.log(`[${handlerName}] Received message on subject "${msg.subject}"`);
                    const data = this.sc.decode(msg.data);
                    console.log(`[${handlerName}] Message data:`, data);

                    // Handle request-reply pattern
                    if (msg.reply) {
                        const response = `Processed ${data} at ${new Date().toISOString()}`;
                        msg.respond(this.sc.encode(response));
                        console.log(`[${handlerName}] Sent reply:`, response);
                    }
                } catch (err) {
                    console.error(`[${handlerName}] Error processing message:`, err);
                    // If it's a request, send error response
                    if (msg.reply) {
                        msg.respond(this.sc.encode(`Error: ${err}`));
                    }
                }
            }
        })().catch((err) => {
            console.error(`[${handlerName}] Subscription handler error:`, err);
        });
    }

    async stop() {
        try {
            console.log('Stopping NATS server...');
            await this.nc.drain();
            await this.nc.close();
            console.log('NATS server stopped successfully');
        } catch (err) {
            console.error('Error stopping NATS server:', err);
            throw err;
        }
    }
}

// Start the server
const server = new NatsServer();

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Received SIGINT signal');
    try {
        await server.stop();
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

// Start the server
server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});