UserData = function () {
    // Handle to a program object
    this.programObject = 0;

    // Attribute locations
    this.positionLoc = 0;
    this.texCoordLoc = 0;

    // Sampler location
    this.depthLoc = 0;
    this.normalLoc = 0;
    this.uResolutionLoc = 0;
    this.uTimeLoc = 0;
    this.uScroll = 0;
    this.uXOffset = 0;
    this.uYOffset = 0;

    // Texture handle
    this.depthId = 0;
    this.normalId = 0;

    // VBOs
    this.vertexObject = 0;
    this.vertexBytesPerElement = 0;
    this.indexObject = 0;

    this.time = 0;
    this.scrollTarget = 0;
    this.scrollCurrent = 0;

    this.tex1 = 0;
    this.tex2 = 0;

    this.zoomLevel = 1;
    this.zoomValue = 1;
    this.zoomCurrent = 1;
    this.zoomTarget = 1;

    this.xOffset = 0;
    this.yOffset = 0;
    this.xOffsetActual = 0;
    this.yOffsetActual = 0;

    this.frameRate = 0;
    this.performanceTime = 0;
    this.tick = 0;
}

function CreateSimpleTexture2D(imSrc) {
    var textureId = gl.createTexture();

    // Bind the texture object
    gl.bindTexture(gl.TEXTURE_2D, textureId);

    const level = 0;
    const internalFormat = gl.RGB;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGB;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255]);
    gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        width,
        height,
        border,
        srcFormat,
        srcType,
        pixel,
    );

    var image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
        // Generate a texture object
        gl.bindTexture(gl.TEXTURE_2D, textureId);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };

    image.src = imSrc;

    return image, textureId;
}

///
// Initialize the shader and program object
//
function Init(esContext) {
    var userData = esContext.userData;
    var vShaderStr =
        `attribute vec4 a_position;   
        attribute vec2 a_texCoord;  
        varying vec2 v_texCoord;
        void main()     
        {
            gl_Position = a_position;
            v_texCoord = a_texCoord; 
        }`;

    var fShaderStr =
        `precision mediump float;
        varying vec2 v_texCoord;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_scroll;
        uniform sampler2D depth_map;
        uniform sampler2D normal_map;
        uniform float u_zoom;
        uniform float u_xOffset;
        uniform float u_yOffset;
        void main() {
            float imageAspectRatio = 1.3285;
            float viewportAspectRatio = u_resolution.y / u_resolution.x;
            vec2 uv = (gl_FragCoord.xy-.5*u_resolution)/u_resolution.y;
            uv.y /= imageAspectRatio;
            uv *= 2.;
            uv.y /= -1.;
            float zoom = u_zoom;
            vec2 offset = vec2(u_xOffset, u_yOffset);
            uv -= offset;
            uv /= zoom;
            uv += offset;
            uv += offset/zoom;
            vec2 uv1 = uv;
            float mask = abs(uv1.x) > 0.5 || abs(uv1.y) > 0.5 ? 0. : 1.;
            uv1.y = max(abs(uv1.y)-.125,0.)*u_resolution.y/u_resolution.x;
            float border = 1.-abs(-abs(uv1.x+uv1.y)-abs(-uv1.x+uv1.y));
            border = border < .0 ? 1.+ 4.*border : 1.;
            float frame = sqrt(1.-pow(2.*border-1.,2.));\n\
            uv.x += .04;\n\
            uv.y += .08;\n\
            vec4 tex = texture2D(depth_map, uv+vec2(0.455,.4235));\n\
            vec4 normals = texture2D(normal_map, (uv+vec2(0.4545,.4229))*1.0008);\n\
            //normals = normals*1.41-.707;\n\
            normals -= .5;
            normals *= mask;\n\
            float depth = tex.x + tex.y*256.;
            depth /= 256.;
            depth += tex.z*256.;\n\
            depth /= 256.;\n\
            depth *= mask;\n\
            float min_water = -806.35;\n\
            float max_water = 872.3646;\n\
            float water_level = u_scroll;\n\
            float norm_water = (water_level-min_water) / (max_water-min_water);\n\
            float islands = smoothstep(norm_water-0.,norm_water+.0000001,depth);\n\
            float mountains = smoothstep(norm_water,1.,depth);\n\
            mountains = pow(mountains,.9);\n\
            islands -= mountains;\n\
            float water_edge = depth < norm_water ? smoothstep(norm_water-.04, norm_water, depth) : smoothstep(norm_water+.005, norm_water, depth);\n\
            water_edge = 1. - sqrt(1. - pow(water_edge,2.)); // pow(water_edge,4.);\n\
            water_edge = smoothstep(.05,.45,water_edge);\n\
            float angle = u_time;\n\
            vec3 light = vec3(cos(angle),sin(angle),-1.);\n\
            float shade = dot(normals.xyz,light);\n\
            float water = 1. - (islands+mountains);\n\
            shade = water > 0. ? 0.1*shade : shade;\n\
            float red = islands*.2 + water*.1 + shade*.5 + mountains*.4;\n\
            float green = islands*.45  + shade*.4 + water*.2+mountains*.1;\n\
            float blue = islands*.15 + water*.65+shade*.1;\n\
            red *= (water_edge*.4+1.);\n\
            green *= (water_edge*.6+1.);\n\
            blue *= (water_edge*.4+1.);\n\
            red = pow(red,.5);\n\
            green = pow(green,.7);\n\
            blue = pow(blue,.7);\n\
            blue -= 0.4*shade;
            green += 0.2*shade;
            red += 0.4*shade;
            vec4 color = vec4(red,green,blue,1.);+frame*.5;\n\
            gl_FragColor = color;\n\
        }\n`;

    // Load the shaders and get a linked program object
    userData.programObject = esLoadProgram(vShaderStr, fShaderStr);

    // Get the attribute locations
    userData.positionLoc = gl.getAttribLocation(userData.programObject, "a_position");
    userData.texCoordLoc = gl.getAttribLocation(userData.programObject, "a_texCoord");

    // Get the sampler location
    userData.depthLoc = gl.getUniformLocation(userData.programObject, "depth_map");
    userData.normalLoc = gl.getUniformLocation(userData.programObject, "normal_map");
    userData.uResolutionLoc = gl.getUniformLocation(userData.programObject, "u_resolution");
    userData.uTimeLoc = gl.getUniformLocation(userData.programObject, "u_time");
    userData.uScroll = gl.getUniformLocation(userData.programObject, "u_scroll");
    userData.uZoom = gl.getUniformLocation(userData.programObject, "u_zoom");
    userData.uXOffset = gl.getUniformLocation(userData.programObject, "u_xOffset");
    userData.uYOffset = gl.getUniformLocation(userData.programObject, "u_yOffset");

    // Load the texture
    userData.tex1, userData.depthId = CreateSimpleTexture2D("FO_high_res_depth_80635e-02_height_8723646240234375e-13_res_50x50.png");
    userData.tex2, userData.normalId = CreateSimpleTexture2D("FO-normal-map.png");

    // Setup the vertex data
    var vVertices = new Float32Array(
        [-1., 1., 0.0,  // Position 0
        -1.0, -1.0,       // TexCoord 0
        -1, -1, 0.0,  // Position 1
        -1.0, 1.0,       // TexCoord 1
            1, -1, 0.0,  // Position 2
            1.0, 1.0,       // TexCoord 2
            1, 1, 0.0,  // Position 3
            1.0, -1.0        // TexCoord 3
        ]);
    var indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    userData.vertexObject = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, userData.vertexObject);
    gl.bufferData(gl.ARRAY_BUFFER, vVertices, gl.STATIC_DRAW);
    userData.vertexBytesPerElement = vVertices.BYTES_PER_ELEMENT;
    userData.indexObject = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, userData.indexObject);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    return true;
}

function Draw(esContext) {
    var userData = esContext.userData;

    // Set the viewport
    gl.viewport(0, 0, esContext.width, esContext.height);

    // Clear the color buffer
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the program object
    gl.useProgram(userData.programObject);

    // Load the vertex position
    gl.bindBuffer(gl.ARRAY_BUFFER, userData.vertexObject);
    gl.vertexAttribPointer(userData.positionLoc, 3, gl.FLOAT,
        false, 5 * userData.vertexBytesPerElement, 0);
    // Load the texture coordinate
    gl.vertexAttribPointer(userData.texCoordLoc, 2, gl.FLOAT,
        false, 5 * userData.vertexBytesPerElement,
        3 * userData.vertexBytesPerElement);

    gl.enableVertexAttribArray(userData.positionLoc);
    gl.enableVertexAttribArray(userData.texCoordLoc);

    canvas = document.getElementById("webgl-canvas");

    // Set the sampler texture unit to 0
    gl.uniform1i(userData.depthLoc, 0);
    gl.uniform1i(userData.normalLoc, 1);
    gl.uniform2f(userData.uResolutionLoc, esContext.width, esContext.height);
    gl.uniform1f(userData.uTimeLoc, userData.time);
    gl.uniform1f(userData.uScroll, userData.scroll);
    gl.uniform1f(userData.uZoom, userData.zoomValue);
    gl.uniform1f(userData.uXOffset, userData.xOffsetActual);
    gl.uniform1f(userData.uYOffset, userData.yOffsetActual);

    userData.xOffsetActual = userData.xOffsetActual + 0.55 * (userData.xOffset - userData.xOffsetActual)
    userData.yOffsetActual = userData.yOffsetActual + 0.55 * (userData.yOffset - userData.yOffsetActual)

    if (userData.time > 6.283185307179586476925286766559) {
        userData.time = 0;
    }
    userData.time += .005;
    userData.scroll = userData.scrollCurrent + 0.2 * (parseInt(document.getElementById("seaLevel").value) - userData.scrollCurrent);
    userData.scrollCurrent = userData.scroll;

    userData.zoomLevel = userData.zoomCurrent + 0.9 * (userData.zoomTarget - userData.zoomCurrent);
    userData.zoomValue = userData.zoomLevel;
    userData.zoomCurrent = userData.zoomLevel;

    // Bind the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, userData.depthId);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, userData.normalId);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, userData.indexObject);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function main() {
    var canvas = document.getElementById("webgl-canvas");
    var slider = document.getElementById("seaLevel");
    var wrapper = document.getElementById("map");
    var displayText = document.getElementById("depthDisplay");
    var framerateText = document.getElementById("frameRate");
    var navigationInfo = document.getElementById("navigation-info");
    var text = document.getElementsByClassName("text");
    var scrollInfo = document.getElementById("scroll-info");
    var imageAspectRatio = 1.3285;
    map.width = window.innerWidth;
    map.height = window.innerHeight;
    canvas.width = window.innerWidth * .9;
    canvas.height = window.innerHeight;
    console.log(window.innerWidth, window.innerHeight);
    var esContext = new ESContext();
    var userData = new UserData();

    function displaySeaLevel() {
        displayText.classList.remove("info-hidden");//.hidden = false;
        displayText.innerHTML = "Sea level: " + slider.value.toString() + " m";
    }

    document.body.style.overflow = 'hidden';
    document.body.addEventListener("touchstart", () => {
        navigationInfo.classList.add("info-hidden");
        scrollInfo.hidden = true;
        
    }, true);
    document.body.addEventListener( "mousedown", () => {
        navigationInfo.classList.add("info-hidden");
        scrollInfo.hidden = true;
    }, true);


    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        navigationInfo.querySelector("ul#mobile").hidden = false;
    } else {
        console.log("is PC");
        navigationInfo.querySelector("ul#PC").hidden = false;
    }


    slider.addEventListener("touchstart", function (e) {
        displaySeaLevel();
    })

    slider.addEventListener("touchmove", function (e) {
        displaySeaLevel();
    })

    slider.addEventListener("touchend", function (e) {
        displayText.classList.add("info-hidden");
    })

    var draggingSlider = false;

    slider.addEventListener("mousedown", function (e) {
        draggingSlider = true;
        displaySeaLevel();
    })

    slider.addEventListener("mousemove", function (e) {
        if (draggingSlider) {
            displaySeaLevel();
        }
    })

    slider.addEventListener("mouseup", function (e) {
        draggingSlider = false;
        displayText.classList.add("info-hidden");//hidden = true;
    })

    slider.addEventListener('wheel', function (e) {
        e.preventDefault();
        let value = parseInt(slider.value);
        value -= e.deltaY;
        slider.value = value.toString();
        console.log(e.deltaY, slider.value);
        displaySeaLevel();
    })

    canvas.addEventListener('wheel', function (e) {
        e.preventDefault();

        userData.zoomTarget *= -e.deltaY*.002 + 1;
        userData.zoomTarget = userData.zoomTarget > 8 ? 8 : userData.zoomTarget;
        userData.zoomTarget = userData.zoomTarget < 1 ? 1 : userData.zoomTarget;
    });

    let isDragging = false;
    let previousX, previousY;
    let dragPointX, dragPointY;

    function interactionStart(x, y) {
        console.log(x, y);
        dragPointX = x - canvas.getBoundingClientRect().left;
        dragPointY = y - canvas.getBoundingClientRect().top;
        console.log(dragPointX, dragPointY);
        previousX = userData.xOffset;
        previousY = userData.yOffset;
    }

    function interactionMove(x, y, mobile = false) {
        var aspectRatio = mobile ? canvas.height / canvas.width : 1;
        userData.xOffset = previousX - (x - dragPointX) / 400 / aspectRatio / userData.zoomValue;
        userData.yOffset = previousY - (y - dragPointY) / 400 / aspectRatio / imageAspectRatio / userData.zoomValue;
        userData.xOffset = userData.xOffset > 0.5 ? 0.5 : userData.xOffset;
        userData.xOffset = userData.xOffset < -0.5 ? -0.5 : userData.xOffset;
        userData.yOffset = userData.yOffset > 0.5 ? 0.5 : userData.yOffset;
        userData.yOffset = userData.yOffset < -0.5 ? -0.5 : userData.yOffset;
    }

    function resizeWindow() {
        displayText.style.fontSize = canvas.width > canvas.height ? "5vh" : "5vw";
        document.querySelector(".text").style.fontSize = canvas.width > canvas.height ? "2vw" : "2vh";
        canvas.width = window.innerWidth * .9;
        canvas.height = window.innerHeight;
        esContext.width = canvas.width;
        esContext.height = canvas.height;
    }

    screen.orientation.onchange = resizeWindow;// addEventListener("change", (e) => {resizeWindow();});

    window.addEventListener("deviceorientation", function (e) {
        resizeWindow();
    }, true);

    window.addEventListener("resize", (e) => {
        resizeWindow();
    });

    var touchDragging = false;
    var touchScaling = false;
    var pinchStart = 0;

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            touchDragging = true;
            touchScaling = false;
            let x = e.changedTouches[0].clientX;
            let y = e.changedTouches[0].clientY;
            interactionStart(x, y);
        }
        if (e.touches.length === 2) {
            touchScaling = true;
            touchDragging = false;
            let x0 = e.touches[0].clientX;
            let y0 = e.touches[0].clientY;
            let x1 = e.touches[1].clientX;
            let y1 = e.touches[1].clientY;
            pinchStart = Math.hypot(x0 - x1, y0 - y1);
        }
    })

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (touchDragging) {
            let x = e.changedTouches[0].clientX;
            let y = e.changedTouches[0].clientY;
            interactionMove(x, y, mobile = true);
        }
        if (touchScaling) {
            touchDragging = false;
            var aspectRatio = canvas.height / canvas.width;
            let x0 = e.touches[0].clientX;
            let y0 = e.touches[0].clientY;
            let x1 = e.touches[1].clientX;
            let y1 = e.touches[1].clientY;
            let currentPinch = Math.hypot(x0 - x1, y0 - y1);
            userData.zoomTarget *= 1 + (currentPinch - pinchStart)*.005 / aspectRatio;
            userData.zoomTarget = userData.zoomTarget > 8 ? 8 : userData.zoomTarget;
            userData.zoomTarget = userData.zoomTarget < 1 ? 1 : userData.zoomTarget;
            pinchStart = currentPinch;
        }
    })

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchDragging = false;
        touchScaling = false;
    });

    draggingMap = false;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true
        interactionStart(e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            interactionMove(e.clientX, e.clientY);
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    esInitContext(esContext, canvas);
    esContext.userData = userData;

    if (!Init(esContext))
        return 0;

    resizeWindow();

    esRegisterDrawFunc(esContext, Draw);

    esMainLoop(esContext);
}