const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

// Função para redimensionar o canvas
function resizeCanvas() {
    const aspectRatio = 16 / 9; // Altere para a proporção desejada
    const maxWidth = window.innerWidth * 1;
    const maxHeight = window.innerHeight * 1;

    if (maxWidth / maxHeight > aspectRatio) {
        canvas.width = maxHeight * aspectRatio;
        canvas.height = maxHeight;
    } else {
        canvas.width = maxWidth;
        canvas.height = maxWidth / aspectRatio;
    }
}

// Redimensione o canvas ao carregar a página e ao redimensionar a janela
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

if (!gl) {
    alert('Seu navegador não suporta WebGL.');
}

const vertexShaderSource = `
attribute vec4 a_position;
void main() {
    gl_Position = a_position;
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_cameraPosition;
uniform vec3 u_spherePosition;
uniform vec3 u_lightColor;

float sun(vec3 p) {
    return length(p - u_spherePosition) - 0.4;
}

float sdTorus(vec3 p, vec2 t)
{
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdTorus2(vec3 p, vec2 t)
{
  vec2 q = vec2(length(p.xy) - t.x, p.z);
  return length(q) - t.y;
}

float sdTorus3(vec3 p, vec2 t)
{
  vec2 q = vec2(length(p.yz) - t.x, p.x);
  return length(q) - t.y;
}

float m_sphere1(vec3 p, float oa, float ob, float oc) {
    float speed = 0.003;
    float x = cos(u_time * speed) * oa;
    float y = sin(u_time * speed) * ob;
    float z = sin(u_time * speed) * oc;
    return length(p - vec3(x, y, z)) - 0.2;
}

float m_sphere2(vec3 p, float oa, float ob, float oc) {
    float speed = 0.003;
    float x = cos(u_time * speed) * oa;
    float y = sin(u_time * speed) * ob;
    float z = cos(u_time * speed) * oc;
    return length(p - vec3(x, y, z)) - 0.2;
}

float m_sphere3(vec3 p, float oa, float ob, float oc) {
    float speed = 0.003;
    float x = cos(u_time * speed) * oa;
    float y = sin(u_time * speed) * ob;
    float z = cos(u_time * speed) * oc;
    return length(p - vec3(x, y, z)) - 0.2;
}

// Função para descrever a cena
float scene(vec3 p) {
    // Esfera 1: raio 1 no centro
    float sun = sun(p);

    float sphere1 = m_sphere1(p, 2.0, 0.0, 2.0);

    float sphere2 = m_sphere2(p, 2.0, 2.0, 0.0);

   float sphere3 = m_sphere3(p, 0.0, 2.0, 2.0);

    float torus1 = sdTorus(p, vec2(2.0, 0.04));
    
    float torus2 = sdTorus2(p, vec2(2.0, 0.04));

    float torus3 = sdTorus3(p, vec2(2.0, 0.04));

    //return min(min(min(min(sun, sphere1), torus), sphere2), sphere3);
    return min(min(min(min(min(min(sun, sphere1), torus1), torus2), sphere2), torus3), sphere3);
}


vec3 getNormal(vec3 p) {
    const float eps = 0.001;
    vec2 h = vec2(eps, 0);
    return normalize(vec3(
        scene(p + h.xyy) - scene(p - h.xyy),
        scene(p + h.yxy) - scene(p - h.yxy),
        scene(p + h.yyx) - scene(p - h.yyx)
    ));
}

float shadow(vec3 ro, vec3 rd, float start, float end) {
    float t = start;
    float res = 1.0;
    for (int i = 0; i < 32; i++) {
        float h = scene(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, 8.0 * h / t);
        t += clamp(h, 0.02, 0.1);
        if (t >= end) break;
    }
    return clamp(res, 0.0, 1.0);
}

vec3 phongLighting(vec3 p, vec3 normal, vec3 cameraPos, vec3 lightPos, vec3 lightColor) {
    vec3 lightDir = normalize(lightPos - p);
    vec3 viewDir = normalize(cameraPos - p);
    vec3 halfDir = normalize(lightDir + viewDir);

    // Componente de luz ambiente
    vec3 ambient = 0.1 * lightColor;

    // Componente de luz difusa
    float diffuseStrength = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * lightColor;

    // Componente de luz especular
    const float shininess = 10.0;
    float specStrength = pow(max(dot(normal, halfDir), 0.0), shininess);
    vec3 specular = specStrength * lightColor;

    return ambient + diffuse + specular;
}

// Função de raymarching
vec3 raymarch(vec3 ro, vec3 rd) {
    float t = 0.1;
    bool isSun = false;
    for (int i = 0; i < 64; i++) {
        vec3 p = ro + t * rd;
        float d = scene(p);
        if (d < 0.001) {
            vec3 normal = getNormal(p);
            // Usar a posição da sphere1 como a posição da luz
            vec3 lightPos = u_spherePosition;
            vec3 lightColor = vec3(u_lightColor.x, u_lightColor.y, u_lightColor.z);
            vec3 color = phongLighting(p, normal, ro, lightPos, lightColor);

            // Verificar se a superfície atingida é a "sun"
            isSun = (sun(p) < 0.001);
            
            if (isSun) {
                color = vec3(u_lightColor.x, u_lightColor.y, u_lightColor.z);
            }
            
            return color;
        }
        t += d;
        if (t > 100.0) {
            break;
        }
    }
    return vec3(0.0, 0.0, 0.0); // Cor de fundo
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv = uv * 2.0 - 1.0;

    float aspectRatio = u_resolution.x / u_resolution.y;
    float fov = 0.1; // Ajuste o campo de visão conforme necessário
    float distanceToScreen = 1.0 / tan(fov * 3.0); // Cálculo da distância da câmera à tela
    
    // Configurar a câmera
    vec3 ro = u_cameraPosition;
    vec3 target = vec3(0.0, 0.0, 0.0);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 forward = normalize(target - ro);
    vec3 right = cross(forward, up);
    vec3 cameraUp = cross(right, forward);

    vec3 rd = normalize(
        uv.x * right * aspectRatio +
        uv.y * cameraUp +
        forward * distanceToScreen
    );

    // Chamar a função de raymarching
    vec3 color = raymarch(ro, rd);


    gl_FragColor = vec4(color, 1.0);
}
`;

let cameraPosition = vec3(-2, 2, 10);
let spherePosition = vec3(0, 0, 0);
let lightColor = vec3(1, 1, 1);

function vec3(x, y, z) {
    return {x: x, y: y, z: z};
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Erro ao compilar o shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Erro ao vincular o programa:', gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1,
]), gl.STATIC_DRAW);

const a_position = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(a_position);
gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

const cameraPositionUniformLocation = gl.getUniformLocation(program, 'u_cameraPosition');
const spherePositionUniformLocation = gl.getUniformLocation(program, 'u_spherePosition');
const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
const lightColorUniformLocation = gl.getUniformLocation(program, 'u_lightColor');
const timeUniformLocation = gl.getUniformLocation(program, 'u_time');

function render(time) {
    update(1 / 60); // Atualiza a posição da câmera com base nas teclas pressionadas
    update2(1 / 60);
    update3(1 / 60);

    // time *= 0.001; Convertendo para segundos

    gl.viewport(0, 0, canvas.width, canvas.height);
    //gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniform3f(cameraPositionUniformLocation, cameraPosition.x, cameraPosition.y, cameraPosition.z);
    gl.uniform3f(lightColorUniformLocation, lightColor.x, lightColor.y, lightColor.z);
    gl.uniform3f(spherePositionUniformLocation, spherePosition.x, spherePosition.y, spherePosition.z);
    gl.uniform1f(timeUniformLocation, time);
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);

// Adicione as funções handleKeyDown, handleKeyUp e o objeto keys aqui
const keys = {};

function handleKeyDown(event) {
    keys[event.key] = true;
}

function handleKeyUp(event) {
    keys[event.key] = false;
}

// Adicione os event listeners aqui
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

function handleKeyUp(event) {
    keys[event.key] = false;
}

function update(dt) {
    const speed = 10.0 * dt;

    if (keys['w'] || keys['W']) {
        spherePosition.y -= speed;
    }
    if (keys['s'] || keys['S']) {
        spherePosition.y += speed;
    }
    if (keys['d'] || keys['D']) {
        spherePosition.x -= speed;
    }
    if (keys['a'] || keys['A']) {
        spherePosition.x += speed;
    }
    if (keys['q'] || keys['Q']) {
        spherePosition.z -= speed;
    }
    if (keys['e'] || keys['E']) {
        spherePosition.z += speed;
    }
}

function update2(dt) {
    const speed = 10.0 * dt;

    if (keys['t'] || keys['T']) {
        cameraPosition.y -= speed;
    }
    if (keys['g'] || keys['G']) {
        cameraPosition.y += speed;
    }
    if (keys['h'] || keys['H']) {
        cameraPosition.x -= speed;
    }
    if (keys['f'] || keys['F']) {
        cameraPosition.x += speed;
    }
    if (keys['r'] || keys['R']) {
        cameraPosition.z -= speed;
    }
    if (keys['y'] || keys['Y']) {
        cameraPosition.z += speed;
    }
}

function update3(dt) {
    const speed = 10.0 * dt;

    if (keys['z'] || keys['Z']) {
        lightColor.x -= speed;
    }
    if (keys['x'] || keys['X']) {
        lightColor.x += speed;
    }
    if (keys['c'] || keys['C']) {
        lightColor.y -= speed;
    }
    if (keys['v'] || keys['V']) {
        lightColor.y += speed;
    }
    if (keys['b'] || keys['B']) {
        lightColor.z -= speed;
    }
    if (keys['n'] || keys['N']) {
        lightColor.z += speed;
    }
}