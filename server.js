const express = require('express');
const productos = require('./api/productos');
const Mensajes = require('./api/mensajes')
const handlebars = require('express-handlebars')
const app = express();
const http = require('http');
const server = http.Server(app);
const io = require('socket.io')(server);
const Faker = require('./models/faker');
const normalize = require('normalizr').normalize;
const schema = require('normalizr').schema;
const session = require('express-session');
const cookieParser = require('cookie-parser')
const passport = require('passport');
const bCrypt = require('bCrypt');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/users')
//CONECTAR CON MONGOOSE A LA DB DE MONGO
require('./database/connection');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------------------------

// PASSPORT
passport.use('signup', new LocalStrategy({
    passReqToCallback: true
},
    function (req, username, password, done) {
        findOrCreateUser = function () {
            User.findOne({ 'username': username }, function (err, user) {
                if (err) {
                    console.log('Error en Registro: ' + err);
                    return done(err);
                }
                if (user) {
                    console.log('El usuario ya existe');
                    return done(null, false,
                        console.log('El usuario ya existe'));
                } else {
                    var newUser = new User();
                    newUser.username = username;
                    newUser.password = createHash(password);

                    newUser.save(function (err) {
                        if (err) {
                            console.log('Error al guardar usuario: ' + err);
                            throw err;
                        }
                        console.log('Se registro al usuario con exito');
                        return done(null, newUser);
                    });
                }
            });
        }
        process.nextTick(findOrCreateUser);
    })
);

// Crea un hash usando bCrypt
var createHash = function (password) {
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

passport.use('login', new LocalStrategy({
    passReqToCallback: true
},
    function (req, username, password, done) {
        User.findOne({ 'username': username },
            function (err, user) {
                if (err)
                    return done(err);
                if (!user) {
                    console.log('User Not Found with username ' + username);
                    return done(null, false,
                        console.log('message', 'User Not found.'));
                }
                if (!isValidPassword(user, password)) {
                    console.log('Invalid Password');
                    return done(null, false,
                        console.log('message', 'Invalid Password'));
                }
                return done(null, user);
            }
        );
    })
);

var isValidPassword = function (user, password) {
    return bCrypt.compareSync(password, user.password);
}

passport.serializeUser(function (user, done) {
    done(null, user._id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});


app.use(passport.initialize());
app.use(passport.session());

// ---------------------------------------------------------------------------------------------

// ARCHIVOS ESTÁTICOS
app.use(express.static('public'));

//CONFIGURAR HANDLEBARS
app.engine('hbs', handlebars({
    extname: '.hbs',
    defaultLayout: 'index.hbs',
    layoutsDir: __dirname + '/views/layouts'
}));

// ESTABLECER MOTOR DE PLANTILLAS
app.set("view engine", "hbs");
// DIRECTORIO ARCHIVOS PLANTILLAS
app.set("views", "./views");

// CREAR ROUTER
const routerProductos = express.Router();
const routerMensajes = express.Router();

// USAR ROUTERS
app.use('/api/productos', routerProductos);
app.use('/api/mensajes', routerMensajes);


// ---------------------------------------------------------------------------------------------


// LOGIN 
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        var user = req.user;
        console.log('user logueado');
        res.render('vista', { showLogin: false, showContent: true, bienvenida: user.username, showBienvenida: true, bienvenida: user.username });
    }
    else {
        console.log('El usuario NO está logueado');
        res.render('vista', { showLogin: true, showContent: false, showBienvenida: false });
    }
})

app.get('/faillogin', (req, res) => {
    res.sendFile(__dirname + '/public/failLogin.html')
})

app.post('/login', passport.authenticate('login', { failureRedirect: '/faillogin' }), (req, res) => {

    res.render('vista', { showLogin: false, showContent: true, bienvenida: req.user.username, showBienvenida: true });

});

// LOGOUT
app.get('/logout', (req, res) => {
    req.logout();
    res.sendFile(__dirname + '/public/logout.html')
})

// REGISTRO

app.get('/signup', (req, res) => {
    res.render('register', {})
})

app.post('/signup', passport.authenticate('signup', { failureRedirect: '/failsignup' }), (req, res) => {
    var user = req.user;
    res.render('vista', { showLogin: false, showContent: true, bienvenida: user.username, showBienvenida: true });
})

app.get('/failsignup', (req, res) => {
    res.sendFile(__dirname + '/public/failSignup.html')
})


// ////////////////// MENSAJES ///////////////////////

// LISTAR TODOS LOS MENSAJES
routerMensajes.get('/leer', async (req, res) => {
    try {
        let result = await Mensajes.devolver();
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// LISTAR MENSAJES POR ID
routerMensajes.get('/leer/:id', async (req, res) => {
    try {
        let result = await Mensajes.buscarPorId(req.params.id);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// GUARDAR MENSAJES EN DB
routerMensajes.post('/guardar', async (req, res) => {
    try {
        let result = await Mensajes.guardar(req.body);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// ACTUALIZAR UN MENSAJE
routerMensajes.put('/actualizar/:id', async (req, res) => {
    try {
        let result = await Mensajes.actualizar(req.params.id, req.body);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// BORRAR UN MENSAJE
routerMensajes.delete('/borrar/:id', async (req, res) => {
    try {
        let result = await Mensajes.borrar(req.params.id);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// VISTA-TEST ** FAKER **
routerProductos.get('/vista-test/', (req, res) => {
    res.render('vista', { hayProductos: true, productos: Faker.generarProductos(10) })
})

routerProductos.get('/vista-test/:cant', (req, res) => {
    let cantidad = req.params.cant
    res.render('vista', { hayProductos: true, productos: Faker.generarProductos(cantidad) })
})

// LISTAR PRODUCTOS
routerProductos.get('/listar', async (req, res) => {
    try {
        let result = await productos.listar();
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

// LISTAR PRODUCTOS POR ID
routerProductos.get('/listar/:id', async (req, res) => {

    try {
        let mensajeLista = await productos.listarPorId(req.params.id);
        res.json(mensajeLista)
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})


// GUARDAR PRODUCTO
routerProductos.post('/guardar', async (req, res) => {
    try {
        let nuevoProducto = {};
        nuevoProducto.title = req.body.title;
        nuevoProducto.price = req.body.price;
        nuevoProducto.thumbnail = req.body.thumbnail;
        await productos.guardar(nuevoProducto)
        res.json(nuevoProducto)
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

//ACTUALIZAR PRODUCTO POR ID
routerProductos.put('/actualizar/:id', async (req, res) => {
    try {
        let nuevoProducto = await productos.actualizar(req.params.id, req.body);
        res.json(nuevoProducto);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

// BORRAR PRODUCTO POR ID
routerProductos.delete('/borrar/:id', async (req, res) => {
    let productoBorrado = await productos.borrar(req.params.id);
    return res.json(productoBorrado);
})

// DATOS CHAT
const messages = [
    {
        autor: {
            email: "juan@gmail.com",
            nombre: "Juan",
            apellido: "Perez",
            edad: 25,
            alias: "Juano",
            avatar: "http://fotos.com/avatar.jpg"
        },
        texto: '¡Hola! ¿Que tal?'
    }
];

// SE EJECUTA AL REALIZAR LA PRIMERA CONEXION
io.on('connection', async socket => {
    console.log('Usuario conectado')

    // GUARDAR PRODUCTO
    socket.on('nuevo-producto', nuevoProducto => {
        console.log(nuevoProducto)
        productos.guardar(nuevoProducto)
    })
    // VERIFICAR QUE SE AGREGA UN PRODUCTO
    socket.emit('guardar-productos', () => {
        socket.on('notificacion', data => {
            console.log(data)
        })
    })
    // ACTUALIZAR TABLA
    socket.emit('actualizar-tabla', await productos.listar())

    // GUARDAR Y MANDAR MENSAJES QUE LLEGUEN DEL CLIENTE
    socket.on("new-message", async function (data) {


        await Mensajes.guardar(data)

        let mensajesDB = await Mensajes.getAll()

        const autorSchema = new schema.Entity('autor', {}, { idAttribute: 'nombre' });

        const mensajeSchema = new schema.Entity('texto', {
            autor: autorSchema
        }, { idAttribute: '_id' })

        const mensajesSchema = new schema.Entity('mensajes', {
            msjs: [mensajeSchema]
        }, { idAttribute: 'id' })

        const mensajesNormalizados = normalize(mensajesDB, mensajesSchema)

        messages.push(mensajesDB);

        console.log(mensajesDB)

        console.log(mensajesNormalizados)

        io.sockets.emit("messages", mensajesNormalizados);
    });
});

// pongo a escuchar el servidor en el puerto indicado
const puerto = 8080;

// USO server PARA EL LISTEN
const svr = server.listen(puerto, () => {
    console.log(`servidor escuchando en http://localhost:${puerto}`);
});


// en caso de error, avisar
server.on('error', error => {
    console.log('error en el servidor:', error);
});
