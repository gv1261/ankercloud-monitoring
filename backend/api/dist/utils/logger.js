"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const config_1 = require("../config");
const isDevelopment = config_1.config.server.env === 'development';
exports.logger = (0, pino_1.default)({
    level: config_1.config.logging.level,
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            path: req.path,
            parameters: req.parameters,
            headers: req.headers,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
});
//# sourceMappingURL=logger.js.map