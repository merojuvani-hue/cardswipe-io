import Phaser from 'phaser';
import { SPELLS, audioFX } from './spells.js';

const WORLD = 2400;
const NAMES = ['Nyx','Rook','Vex','Mira','Onyx','Kairo','Zara','Hex','Juno','Rune','Ash','Echo'];
const COLORS = [0xff5978,0xb678ff,0xffbd57,0x6cffbd,0xff7e45,0x63a9ff,0xff6ce8,0x9aa7ff,0xf2ef71,0x54ffe0,0xffa1b5,0x89ed79];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default class ArenaScene extends Phaser.Scene {
  constructor() { super('ArenaScene'); }

  create() {
    this.gameLive = false;
    this.playerName = 'Player';
    this.skin = { name: 'Arcane Cyan', color: '#36e7f2', hex: 0x36e7f2 };
    this.playerHp = 100; this.score = 0; this.kills = 0; this.elapsed = 0;
    this.hand = []; this.cooldowns = new Set(); this.enemies = []; this.projectileClock = 0;
    this.aimPoint = null; this.focusMode = false; this.joystick = { active: false, x: 0, y: 0 };
    this.virtualKeys = { x: 0, y: 0 }; this.shakePower = 0;
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.drawFloor();
    this.obstacles = this.physics.add.staticGroup();
    this.obstacleRects = [];
    this.createObstacles();
    this.player = this.add.circle(WORLD / 2, WORLD / 2, 22, this.skin.hex, 1);
    this.physics.add.existing(this.player);
    this.player.body.setCircle(18).setCollideWorldBounds(true).setMaxVelocity(150, 150).setDamping(true).setDrag(900);
    this.player.setDepth(4);
    this.playerAura = this.add.circle(this.player.x, this.player.y, 29, this.skin.hex, 0.12).setStrokeStyle(2, this.skin.hex, 0.75).setDepth(3);
    this.playerLabel = this.add.text(this.player.x, this.player.y + 29, this.playerName, { fontFamily: 'Space Mono', fontSize: '10px', color: '#eaffff', stroke: '#06101b', strokeThickness: 3 }).setOrigin(0.5).setDepth(8);
    this.physics.add.collider(this.player, this.obstacles);
    this.enemiesGroup = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.orbs = this.physics.add.staticGroup();
    this.physics.add.collider(this.enemiesGroup, this.obstacles);
    this.physics.add.collider(this.player, this.enemiesGroup, (_p, enemy) => this.contactEnemy(enemy), undefined, this);
    this.physics.add.collider(this.enemiesGroup, this.enemiesGroup);
    this.physics.add.collider(this.enemiesGroup, this.obstacles);
    this.physics.add.overlap(this.projectiles, this.enemiesGroup, (shot, enemy) => this.spellHit(shot, enemy), undefined, this);
    this.physics.add.overlap(this.enemyShots, this.player, (player, shot) => this.enemyShotHit(player, shot), undefined, this);
    this.physics.add.collider(this.projectiles, this.obstacles, (shot, obstacle) => this.projectileObstacleHit(shot, obstacle), undefined, this);
    this.physics.add.collider(this.enemyShots, this.obstacles, shot => this.killProjectile(shot), undefined, this);
    this.physics.add.overlap(this.player, this.orbs, (_player, orb) => this.collectOrb(orb), undefined, this);
    this.createEnemies(); this.createOrbs(22);
    this.aimGraphics = this.add.graphics().setDepth(12);
    this.fxGraphics = this.add.graphics().setDepth(11);
    this.electricGraphics = this.add.graphics().setDepth(7);
    this.botTelegraphs = this.add.graphics().setDepth(9);
    this.actorShadowGraphics = this.add.graphics().setDepth(2);
    this.actorDetailGraphics = this.add.graphics().setDepth(8);
    this.cameras.main.setBounds(0, 0, WORLD, WORLD).startFollow(this.player, true, 0.085, 0.085).setZoom(this.getZoom());
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.input.on('pointerdown', pointer => {
      if (pointer.x < this.scale.width * 0.36 && pointer.y > this.scale.height * 0.55) {
        this.joystick.active = true; this.joystick.pointerId = pointer.id; this.joystick.x = pointer.x; this.joystick.y = pointer.y;
      }
    });
    this.input.on('pointermove', pointer => {
      if (this.joystick.active && pointer.id === this.joystick.pointerId && pointer.isDown) {
        const dx = pointer.x - this.joystick.x, dy = pointer.y - this.joystick.y, length = Math.max(1, Math.hypot(dx, dy));
        const deadZone = 8, strength = length <= deadZone ? 0 : Math.min(1, (length-deadZone)/(46-deadZone));
        this.virtualKeys.x = (dx/length)*strength;
        this.virtualKeys.y = (dy/length)*strength;
      }
    });
    this.input.on('pointerup', pointer => { if(pointer.id===this.joystick.pointerId){this.joystick.active = false; this.joystick.pointerId=null; this.virtualKeys.x = 0; this.virtualKeys.y = 0;} });
    this.scale.on('resize', () => this.cameras.main.setZoom(this.getZoom()));
    this.game.events.on('ui:start', payload => this.startRun(payload));
    this.game.events.on('ui:home', () => this.returnHome());
    this.game.events.on('ui:cast', payload => this.cast(payload.card, payload.direction));
    this.game.events.on('ui:aim', payload => this.setAim(payload.worldPoint,payload.card));
    this.game.events.on('ui:aim-cancel', () => this.clearAim());
    this.game.events.on('ui:fuse', payload => this.fuseCards(payload.from, payload.to));
    this.game.events.on('ui:move', payload => { this.virtualKeys.x = payload.x; this.virtualKeys.y = payload.y; });
    this.game.events.on('ui:move-end', () => { this.virtualKeys.x = 0; this.virtualKeys.y = 0; });
    window.addEventListener('resize', this.onWindowResize = () => this.cameras.main.setZoom(this.getZoom()));
    this.scene.pause();
  }

  drawFloor() {
    const background = this.add.rectangle(WORLD / 2, WORLD / 2, WORLD, WORLD, 0x090d19).setDepth(-20);
    background.setStrokeStyle(5, 0x36e7f2, 0.45);
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x0a1020, 1); g.fillRect(0, 0, 80, 80);
    g.lineStyle(1, 0x26324a, 0.4); g.beginPath(); g.moveTo(0,0); g.lineTo(80,0); g.moveTo(0,0); g.lineTo(0,80); g.strokePath();
    g.lineStyle(1, 0x36e7f2, 0.08); g.strokeRect(0,0,80,80); g.generateTexture('arena-grid',80,80); g.destroy();
    this.add.tileSprite(WORLD/2, WORLD/2, WORLD, WORLD, 'arena-grid').setDepth(-19);
    const corners = this.add.graphics().setDepth(-15); corners.lineStyle(3,0x36e7f2,0.28);
    for (const [x,y,sx,sy] of [[28,28,1,1],[WORLD-28,28,-1,1],[28,WORLD-28,1,-1],[WORLD-28,WORLD-28,-1,-1]]) {
      corners.beginPath(); corners.moveTo(x,y+sy*52); corners.lineTo(x,y); corners.lineTo(x+sx*52,y); corners.strokePath();
    }
  }

  createObstacles() {
    const positions = [
      [410,360,110,120],[850,330,80,170],[1290,420,140,85],[1830,360,100,130],[2150,620,100,100],
      [330,900,130,90],[770,820,90,120],[1240,760,150,115],[1700,870,120,95],[2070,1110,100,145],
      [390,1450,90,130],[790,1270,150,100],[1230,1540,100,130],[1640,1370,135,90],[2060,1740,140,105],
      [380,1990,135,85],[860,2050,100,140],[1320,2020,145,90],[1800,2070,90,130],[2150,2200,110,100],
      [1110,1110,72,72],[1520,1120,75,75],[1050,1770,65,65],[1470,550,70,70],
    ];
    for (const [x,y,w,h] of positions) {
      const color = Phaser.Math.RND.pick([0x19354b,0x2d234a,0x3b2a38]);
      const body = this.add.rectangle(x,y,w,h,0x000000,0).setDepth(-1);
      this.physics.add.existing(body,true); body.body.setSize(w,h); this.obstacles.add(body);
      this.obstacleRects.push({x,y,w,h});

      // Layered faces and a soft shadow give each collider a readable 2.5D silhouette.
      const visual=this.add.graphics().setDepth(3+y/WORLD*2), halfW=w/2,halfH=h/2,extrude=15;
      visual.fillStyle(0x020510,0.34).fillEllipse(x+5,y+15,w+30,h+30);
      visual.fillStyle(0x070a13,0.88).beginPath().moveTo(x-halfW,y+halfH-2).lineTo(x+halfW,y+halfH-2).lineTo(x+halfW,y+halfH+extrude).lineTo(x-halfW,y+halfH+extrude).closePath().fillPath();
      visual.fillStyle(0x111827,0.78).beginPath().moveTo(x+halfW-2,y-halfH).lineTo(x+halfW+10,y-halfH+7).lineTo(x+halfW+10,y+halfH+extrude).lineTo(x+halfW-2,y+halfH).closePath().fillPath();
      visual.fillStyle(color,0.98).fillRect(x-halfW,y-halfH,w,h);
      visual.fillStyle(0xffffff,0.06).fillRect(x-halfW+3,y-halfH+3,w-6,Math.max(8,h*0.18));
      visual.lineStyle(2,0x6c93b1,0.62).strokeRect(x-halfW,y-halfH,w,h);
      visual.lineStyle(2,0x65e7f1,0.64).beginPath().moveTo(x-halfW+8,y-halfH+8).lineTo(x-halfW+Math.min(28,w/3),y-halfH+8).strokePath();
      visual.lineStyle(1,0x000000,0.36).beginPath().moveTo(x-halfW,y+halfH).lineTo(x+halfW,y+halfH).strokePath();
    }
  }

  createEnemies() {
    for (let i=0;i<12;i++) {
      const angle = (Math.PI*2*i/12) + Phaser.Math.FloatBetween(-0.13,0.13);
      const radius = Phaser.Math.Between(300,850);
      const x = clamp(this.player.x + Math.cos(angle)*radius,100,WORLD-100), y = clamp(this.player.y + Math.sin(angle)*radius,100,WORLD-100);
      const enemy = this.add.circle(x,y,18,COLORS[i],1).setStrokeStyle(2,0xffffff,0.7).setDepth(4);
      this.physics.add.existing(enemy); enemy.body.setCircle(16).setCollideWorldBounds(true).setDamping(true).setDrag(700).setMaxVelocity(100,100);
      enemy.hp = 70; enemy.maxHp = 70; enemy.alive = true; enemy.name = NAMES[i]; enemy.color = COLORS[i]; enemy.aiSlot=i; enemy.orbitDirection=i%2?1:-1; enemy.flankRadius=Phaser.Math.Between(240,360); enemy.score = 0; enemy.kills = 0; enemy.attackWait = Phaser.Math.Between(900,1700); enemy.slowUntil = 0; enemy.lastShot = 0;
      enemy.label = this.add.text(x,y-34,enemy.name,{fontFamily:'Space Mono',fontSize:'9px',color:'#e7efff',stroke:'#080b16',strokeThickness:3}).setOrigin(0.5).setDepth(8);
      enemy.hpGraphics = this.add.graphics().setDepth(8); this.enemiesGroup.add(enemy); this.enemies.push(enemy);
    }
  }

  createOrbs(count) {
    for (let i=0;i<count;i++) {
      let x,y,tries=0;
      do { x=Phaser.Math.Between(80,WORLD-80); y=Phaser.Math.Between(80,WORLD-80); tries++; } while (tries<30 && Phaser.Math.Distance.Between(x,y,this.player.x,this.player.y)<170);
      const orb = this.add.circle(x,y,9,0xffe17c,1).setStrokeStyle(2,0xfff3bd,0.85).setDepth(3);
      this.physics.add.existing(orb,true); orb.body.setCircle(10); orb.phase = Math.random()*6.28; this.orbs.add(orb);
      this.tweens.add({targets:orb,scale:1.22,duration:650+y%200,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    }
  }

  getZoom() { return clamp(Math.min(this.scale.width/960, this.scale.height/650),0.62,1.12); }
  startRun(payload={}) {
    this.playerName = payload.name?.trim() || 'Player'; this.skin = payload.skin || this.skin;
    this.player.setFillStyle(this.skin.hex); this.player.setStrokeStyle(2,0xffffff,0.85); this.playerAura.setFillStyle(this.skin.hex,0.13).setStrokeStyle(2,this.skin.hex,0.8);
    this.playerLabel.setText(this.playerName);
    this.clearProjectiles();
    this.player.body.setVelocity(0); this.player.body.checkCollision.none=false; this.physics.world.timeScale=1; this.virtualKeys={x:0,y:0}; this.joystick.active=false; this.playerHp=100; this.score=0; this.kills=0; this.elapsed=0; this.gameLive=true;
    this.hand=[]; this.cooldowns.clear(); this.enemies.forEach((e,i)=>{e.alive=true;e.hp=e.maxHp;e.score=0;e.kills=0;e.setVisible(true);e.body.enable=true;e.body.setVelocity(0);e.slowUntil=0;e.attackWait=Phaser.Math.Between(900,1700);e.setDepth(4+e.y/WORLD*2);e.label.setVisible(true);e.hpGraphics.setVisible(true);});
    this.enemiesGroup.children.iterate(e=>{if(e){e.setVisible(true);e.body.enable=true;}});
    const deck=['fireball','frost','volt','blink','nova'];
    this.hand=Array.from({length:3},()=>Phaser.Utils.Array.GetRandom(deck));
    this.scene.resume(); this.updateHud(); this.game.events.emit('arena:started', { hand:this.hand.slice() });
  }

  update(_time,delta) {
    if (!this.gameLive) return;
    const dt = Math.min(delta,40); this.elapsed += dt;
    const x = (this.keys.A.isDown||this.keys.LEFT.isDown?-1:0)+(this.keys.D.isDown||this.keys.RIGHT.isDown?1:0)+this.virtualKeys.x;
    const y = (this.keys.W.isDown||this.keys.UP.isDown?-1:0)+(this.keys.S.isDown||this.keys.DOWN.isDown?1:0)+this.virtualKeys.y;
    const mag=Math.hypot(x,y); if(mag>0.1) this.player.body.setAcceleration((x/mag)*520,(y/mag)*520); else this.player.body.setAcceleration(0,0);
    this.player.setDepth(4+this.player.y/WORLD*2); this.playerAura.setPosition(this.player.x,this.player.y); this.playerLabel.setPosition(this.player.x,this.player.y+30);
    this.actorShadowGraphics.clear(); this.actorDetailGraphics.clear(); this.botTelegraphs.clear();
    this.actorShadowGraphics.fillStyle(0x02040b,0.36).fillEllipse(this.player.x+4,this.player.y+16,48,20);
    const playerAngle=this.aimPoint?Phaser.Math.Angle.Between(this.player.x,this.player.y,this.aimPoint.x,this.aimPoint.y):(mag>0.1?Math.atan2(y,x):(this.playerFacing||0));
    if(mag>0.1||this.aimPoint)this.playerFacing=playerAngle;
    this.actorDetailGraphics.lineStyle(2,this.skin.hex,0.46).strokeCircle(this.player.x,this.player.y,25);
    this.drawFacingMark(this.actorDetailGraphics,this.player.x,this.player.y,playerAngle,22,0xf4ffff);
    for(const enemy of this.enemies){
      enemy.label.setPosition(enemy.x,enemy.y-34); enemy.hpGraphics.clear();
      if(!enemy.alive) continue;
      enemy.setDepth(4+enemy.y/WORLD*2);
      enemy.hpGraphics.fillStyle(0x101725,0.88).fillRect(enemy.x-19,enemy.y-27,38,4);
      enemy.hpGraphics.fillStyle(enemy.hp>25?0x64f4c2:0xff6277,1).fillRect(enemy.x-19,enemy.y-27,38*clamp(enemy.hp/enemy.maxHp,0,1),4);
      const dist=Phaser.Math.Distance.Between(enemy.x,enemy.y,this.player.x,this.player.y), angle=Phaser.Math.Angle.Between(enemy.x,enemy.y,this.player.x,this.player.y);
      this.actorShadowGraphics.fillStyle(0x02040b,0.32).fillEllipse(enemy.x+3,enemy.y+13,38,16);
      this.actorDetailGraphics.lineStyle(1.5,enemy.color,0.48).strokeCircle(enemy.x,enemy.y,20);
      this.drawFacingMark(this.actorDetailGraphics,enemy.x,enemy.y,angle,17,0xf5f7ff);

      // Each rival patrols a unique, slowly rotating flank point around the player.
      const flank=enemy.aiSlot*Math.PI*2/this.enemies.length+this.elapsed*0.00011*enemy.orbitDirection;
      const targetX=this.player.x+Math.cos(flank)*enemy.flankRadius,targetY=this.player.y+Math.sin(flank)*enemy.flankRadius;
      let ax=(targetX-enemy.x)*1.25,ay=(targetY-enemy.y)*1.25;
      // Separation prevents rivals from collapsing onto one shared point.
      for(const other of this.enemies){
        if(other===enemy||!other.alive)continue;
        const dx=enemy.x-other.x,dy=enemy.y-other.y,d=Math.hypot(dx,dy);
        if(d>0.1&&d<92){const force=(92-d)*5;ax+=dx/d*force;ay+=dy/d*force;}
      }
      // Push away from obstacle footprints before their physics collider stops movement.
      for(const rect of this.obstacleRects){
        const halfW=rect.w/2+48,halfH=rect.h/2+48,dx=enemy.x-rect.x,dy=enemy.y-rect.y;
        if(Math.abs(dx)<halfW&&Math.abs(dy)<halfH){
          const pushX=halfW-Math.abs(dx),pushY=halfH-Math.abs(dy),force=Math.min(260,Math.max(pushX,pushY)*3.5);
          if(pushX<pushY)ax+=(Math.sign(dx)||((enemy.aiSlot%2)?1:-1))*force;
          else ay+=(Math.sign(dy)||((enemy.aiSlot%2)?1:-1))*force;
        }
      }
      const accelScale=this.elapsed<enemy.slowUntil?0.24:1;
      enemy.body.setAcceleration(clamp(ax*accelScale,-260,260),clamp(ay*accelScale,-260,260));
      enemy.attackWait-=dt;
      if(dist<520&&enemy.attackWait>0&&enemy.attackWait<430){
        const charge=1-enemy.attackWait/430;
        this.botTelegraphs.lineStyle(2,0xff6478,0.3+charge*0.55).beginPath().moveTo(enemy.x,enemy.y).lineTo(this.player.x,this.player.y).strokePath();
        this.botTelegraphs.lineStyle(2,0xff8796,0.32+charge*0.55).strokeCircle(enemy.x,enemy.y,22+charge*8);
      }
      if(enemy.attackWait<=0){
        if(dist<520)this.enemyFire(enemy,angle);
        enemy.attackWait=Phaser.Math.Between(2300,3200);
      }
    }
    this.projectileClock+=dt;
    this.electricGraphics.clear();
    for(const shot of [...this.projectiles.getChildren(),...this.enemyShots.getChildren()]){
      if(!shot.active)continue;
      const velocity=shot.body?.velocity;
      if(!velocity||!Number.isFinite(velocity.x)||!Number.isFinite(velocity.y)){
        this.killProjectile(shot);
        continue;
      }
      shot.life-=dt;
      if(shot.kind==='meteor'&&shot.life<170){this.impactArea(shot.x,shot.y,105,55,0xff9a56);this.killProjectile(shot);continue;}
      // Expired shots were destroyed above but the old loop continued and read their removed body.
      if(shot.life<=0||shot.x<0||shot.y<0||shot.x>WORLD||shot.y>WORLD){this.killProjectile(shot);continue;}
      if(shot.glow?.active)shot.glow.setPosition(shot.x,shot.y);
      if(shot.isFriendly&&this.projectileClock%68<dt)this.projectileTrail(shot);
      if(shot.isFriendly&&(shot.kind==='volt'||shot.kind==='storm')){
        const angle=Math.atan2(velocity.y,velocity.x);
        this.drawLightning(this.electricGraphics,shot.x-Math.cos(angle)*34,shot.y-Math.sin(angle)*34,shot.x+Math.cos(angle)*10,shot.y+Math.sin(angle)*10,shot.kind==='storm'?0xd8faff:0xffe16c,this.projectileClock+shot.x);
      }else if(shot.isFriendly&&shot.kind==='frost'){
        const angle=Math.atan2(velocity.y,velocity.x),tailX=shot.x-Math.cos(angle)*24,tailY=shot.y-Math.sin(angle)*24;
        this.electricGraphics.lineStyle(8,0x53e9f2,0.25).beginPath().moveTo(tailX,tailY).lineTo(shot.x,shot.y).strokePath();
        this.electricGraphics.lineStyle(2,0xe4ffff,0.9).beginPath().moveTo(tailX,tailY).lineTo(shot.x,shot.y).strokePath();
      }
    }
    this.orbs.getChildren().forEach(o=>{if(o.active){o.phase+=dt/350;o.setAlpha(0.73+Math.sin(o.phase)*0.25);}});
    if(this.aimPoint)this.drawTrajectory();
    this.syncHudThrottle(dt);
  }

  syncHudThrottle(dt){this.hudClock=(this.hudClock||0)+dt;if(this.hudClock>130){this.hudClock=0;this.updateHud();}}
  setAim(point,card){this.aimPoint=point;this.aimCard=card;this.focusMode=true;this.physics.world.timeScale=0.85;this.drawTrajectory();}
  clearAim(){this.aimPoint=null;this.aimCard=null;this.focusMode=false;this.physics.world.timeScale=1;this.aimGraphics.clear();}
  drawTrajectory(){
    this.aimGraphics.clear();if(!this.aimPoint)return;
    const angle=Phaser.Math.Angle.Between(this.player.x,this.player.y,this.aimPoint.x,this.aimPoint.y), range=clamp(Phaser.Math.Distance.Between(this.player.x,this.player.y,this.aimPoint.x,this.aimPoint.y),90,640), endX=this.player.x+Math.cos(angle)*range,endY=this.player.y+Math.sin(angle)*range;
    const color=this.handColor(this.aimCard||this.hand[0]);
    for(let d=35;d<range;d+=25){this.aimGraphics.fillStyle(color,0.78-d/range*.35).fillCircle(this.player.x+Math.cos(angle)*d,this.player.y+Math.sin(angle)*d,3.3);}
    this.aimGraphics.lineStyle(1,0xffffff,0.65).strokeCircle(endX,endY,15);this.aimGraphics.lineStyle(2,color,0.95).strokeCircle(endX,endY,7);
    this.aimGraphics.lineStyle(1,color,0.26).beginPath().moveTo(this.player.x,this.player.y).lineTo(endX,endY).strokePath();
  }
  handColor(key){return SPELLS[key]?.color??0x36e7f2;}
  drawFacingMark(graphics,x,y,angle,size,color){
    const tip={x:x+Math.cos(angle)*size,y:y+Math.sin(angle)*size};
    const left={x:x+Math.cos(angle+2.45)*size*0.58,y:y+Math.sin(angle+2.45)*size*0.58};
    const right={x:x+Math.cos(angle-2.45)*size*0.58,y:y+Math.sin(angle-2.45)*size*0.58};
    graphics.fillStyle(color,0.9).fillTriangle(tip.x,tip.y,left.x,left.y,right.x,right.y);
    graphics.lineStyle(1,0x07111a,0.75).beginPath().moveTo(left.x,left.y).lineTo(tip.x,tip.y).lineTo(right.x,right.y).strokePath();
  }

  cast(card, direction){
    if(!this.gameLive)return;
    this.clearAim(); audioFX.launch();
    const dir=direction&&Math.hypot(direction.x,direction.y)>0?direction:{x:1,y:0};const angle=Math.atan2(dir.y,dir.x);
    if(card==='blink'){this.blink(angle,520,15);return;}
    if(card==='shadow'){this.blink(angle,480,0);this.impactArea(this.player.x-Math.cos(angle)*80,this.player.y-Math.sin(angle)*80,115,25,0xb48aff,{freeze:2000});return;}
    if(card==='meteor'){this.blink(angle,440,15);const x=this.player.x+Math.cos(angle)*210,y=this.player.y+Math.sin(angle)*210;this.spawnShot(x,y,angle,55,430,1000,0xff9a56,'meteor');return;}
    if(card==='thermal'){const tx=this.player.x+Math.cos(angle)*360,ty=this.player.y+Math.sin(angle)*360;this.impactArea(tx,ty,155,50,0xffad7d,{freeze:2000});return;}
    if(card==='storm'){for(let i=-1;i<=1;i++){const a=angle+i*0.42;this.spawnShot(this.player.x+Math.cos(a)*30,this.player.y+Math.sin(a)*30,a,45,520,900,0xc4f1ff,'storm');}return;}
    if(card==='plasma'){
      const endX=this.player.x+Math.cos(angle)*760,endY=this.player.y+Math.sin(angle)*760;
      this.fxGraphics.lineStyle(16,0x61eaff,0.23).beginPath().moveTo(this.player.x,this.player.y).lineTo(endX,endY).strokePath();
      this.fxGraphics.lineStyle(4,0xdafaff,1).beginPath().moveTo(this.player.x,this.player.y).lineTo(endX,endY).strokePath();
      this.time.delayedCall(160,()=>this.fxGraphics.clear());
      this.enemies.filter(e=>e.alive&&this.pointLineDist(e.x,e.y,this.player.x,this.player.y,endX,endY)<44).forEach(e=>this.damageEnemy(e,60,0x91f5ff));return;
    }
    if(card==='nova'){this.coneAttack(angle,360,1.08,30,0x8cff86,160);return;}
    const config=SPELLS[card];if(!config)return;
    const speed=card==='fireball'?700:card==='frost'?820:card==='volt'?780:650;
    const life=card==='frost'?1450:card==='volt'?1350:card==='fireball'?1250:900;
    this.spawnShot(this.player.x+Math.cos(angle)*34,this.player.y+Math.sin(angle)*34,angle,config.damage,speed,life,config.color,card);
  }

  blink(angle,distance,trailDamage){
    const startX=this.player.x,startY=this.player.y;
    const dest={x:clamp(startX+Math.cos(angle)*distance,35,WORLD-35),y:clamp(startY+Math.sin(angle)*distance,35,WORLD-35)};
    this.player.body.checkCollision.none=true;this.player.body.reset(dest.x,dest.y);this.player.body.setVelocity(0);
    this.time.delayedCall(360,()=>{if(this.player?.body)this.player.body.checkCollision.none=false;});
    this.fxGraphics.lineStyle(15,0xb48aff,0.2).beginPath().moveTo(startX,startY).lineTo(dest.x,dest.y).strokePath();this.time.delayedCall(180,()=>this.fxGraphics.clear());
    this.particle(startX,startY,0xb48aff,12);this.particle(dest.x,dest.y,0xb48aff,17);
    if(trailDamage) for(const e of this.enemies)if(e.alive&&this.pointLineDist(e.x,e.y,startX,startY,dest.x,dest.y)<42)this.damageEnemy(e,trailDamage,0xb48aff);
  }

  spawnShot(x,y,angle,damage,speed,life,color,kind){
    const shot=this.add.circle(x,y,kind==='fireball'?10:kind==='frost'?7:kind==='volt'?8:9,color,1).setStrokeStyle(2,0xffffff,0.78).setDepth(5);
    const shotSpeed=Number.isFinite(speed)&&speed>0?speed:620;
    const shotDamage=Number.isFinite(damage)&&damage>0?damage:(SPELLS[kind]?.damage||10);
    const safeAngle=Number.isFinite(angle)?angle:0;
    this.physics.add.existing(shot);
    shot.body.setCircle(kind==='nova'?15:kind==='fireball'?10:8).setAllowGravity(false).setCollideWorldBounds(true).setVelocity(Math.cos(safeAngle)*shotSpeed,Math.sin(safeAngle)*shotSpeed);
    shot.body.onWorldBounds=true;
    shot.life=Number.isFinite(life)&&life>0?life:800;shot.damage=shotDamage;shot.color=color;shot.kind=kind;shot.isFriendly=true;shot.hit=new Set();shot.bounces=kind==='volt'?1:0;shot.glow=this.add.circle(x,y,kind==='fireball'?18:kind==='volt'?15:12,color,0.2).setStrokeStyle(2,color,0.42).setDepth(4.8);this.projectiles.add(shot);
    this.particle(x,y,color,3);return shot;
  }

  projectileTrail(shot){
    if(!shot?.active)return;
    const count=shot.kind==='fireball'?3:shot.kind==='storm'?2:1;
    for(let i=0;i<count;i++){
      const spread=shot.kind==='fireball'?10:shot.kind==='frost'?3:7;
      const color=shot.kind==='fireball'?Phaser.Math.RND.pick([0xfff0a1,0xff9a56,0xff655a]):shot.color;
      const dot=this.add.circle(shot.x+Phaser.Math.Between(-spread,spread),shot.y+Phaser.Math.Between(-spread,spread),Phaser.Math.FloatBetween(shot.kind==='fireball'?2:1.5,shot.kind==='fireball'?5:3),color,shot.kind==='fireball'?0.85:0.7).setDepth(4.7);
      this.tweens.add({targets:dot,alpha:0,scale:0.15,duration:shot.kind==='fireball'?220:150,onComplete:()=>dot.destroy()});
    }
  }

  clearProjectiles(){
    if(!this.projectiles||!this.enemyShots)return;
    for(const shot of [...this.projectiles.getChildren(),...this.enemyShots.getChildren()])this.killProjectile(shot);
  }

  retargetVolt(shot,x=shot.x,y=shot.y){
    const target=this.enemies.filter(e=>e.alive&&!shot.hit.has(e)&&Phaser.Math.Distance.Between(x,y,e.x,e.y)<420)
      .sort((a,b)=>Phaser.Math.Distance.Between(x,y,a.x,a.y)-Phaser.Math.Distance.Between(x,y,b.x,b.y))[0];
    if(!target||!shot.body?.velocity){this.killProjectile(shot);return false;}
    const a=Phaser.Math.Angle.Between(x,y,target.x,target.y);
    this.flashLightning(x,y,target.x,target.y,shot.color);
    shot.body.setVelocity(Math.cos(a)*850,Math.sin(a)*850);
    return true;
  }

  projectileObstacleHit(shot,obstacle){
    if(!shot?.active)return;
    if(shot.kind==='fireball')this.impactArea(shot.x,shot.y,92,shot.damage,shot.color);
    else if(shot.kind==='frost')this.impactArea(shot.x,shot.y,48,shot.damage,shot.color,{slow:2000});
    else if(shot.kind==='meteor')this.impactArea(shot.x,shot.y,105,shot.damage,shot.color);
    else if(shot.kind==='volt'&&shot.bounces>0){shot.bounces--;if(this.retargetVolt(shot,shot.x,shot.y))return;}
    this.killProjectile(shot);
  }

  drawLightning(graphics,x1,y1,x2,y2,color,seed=0){
    const dx=x2-x1,dy=y2-y1,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length;
    const segments=Math.max(4,Math.ceil(length/18)),points=[{x:x1,y:y1}],phase=seed*0.017;
    for(let i=1;i<segments;i++){
      const t=i/segments,noise=Math.sin((i*17.31+phase)*12.9898)*Math.cos((i*9.17+phase)*4.1414);
      const offset=noise*Math.min(19,length*0.09);
      points.push({x:x1+dx*t+nx*offset,y:y1+dy*t+ny*offset});
    }
    points.push({x:x2,y:y2});
    graphics.lineStyle(9,color,0.23).beginPath().moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)graphics.lineTo(points[i].x,points[i].y);
    graphics.strokePath();
    graphics.lineStyle(2.6,0xf7ffff,0.98).beginPath().moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)graphics.lineTo(points[i].x,points[i].y);
    graphics.strokePath();
    if(points.length>4){const p=points[Math.floor(points.length*0.55)],branch={x:p.x+nx*19,y:p.y+ny*19};graphics.lineStyle(1.5,0xffffff,0.82).beginPath().moveTo(p.x,p.y).lineTo(branch.x,branch.y).strokePath();}
  }

  flashLightning(x1,y1,x2,y2,color){
    const flash=this.add.graphics().setDepth(9);this.drawLightning(flash,x1,y1,x2,y2,color,this.time.now);
    this.time.delayedCall(130,()=>flash.destroy());
  }

  spellHit(shot,enemy){
    if(!shot.active||!enemy.alive||shot.hit.has(enemy))return;
    shot.hit.add(enemy);
    if(shot.kind==='meteor')return;
    if(shot.kind==='storm'){this.damageEnemy(enemy,shot.damage,shot.color, {knockback:90});}
    else if(shot.kind==='fireball'){this.impactArea(shot.x,shot.y,92,shot.damage,shot.color);this.killProjectile(shot);}
    else if(shot.kind==='frost'){this.damageEnemy(enemy,25,shot.color,{slow:2000});this.particle(shot.x,shot.y,shot.color,12);this.killProjectile(shot);}
    else if(shot.kind==='volt'&&shot.bounces>0&&shot.body?.velocity){
      this.damageEnemy(enemy,30,shot.color);shot.bounces--;
      if(!this.retargetVolt(shot,shot.x,shot.y))this.killProjectile(shot);
    }
    else {this.damageEnemy(enemy,shot.damage,shot.color);this.killProjectile(shot);}
  }

  enemyFire(enemy,angle){
    const shot=this.add.circle(enemy.x,enemy.y,6,enemy.color,0.9).setStrokeStyle(1,0xffe3e8,0.8).setDepth(4);this.physics.add.existing(shot);
    const safeAngle=Number.isFinite(angle)?angle:0;
    shot.body.setCircle(6).setAllowGravity(false).setCollideWorldBounds(true).setVelocity(Math.cos(safeAngle)*190,Math.sin(safeAngle)*190);shot.body.onWorldBounds=true;
    shot.life=3000;shot.damage=5;shot.color=enemy.color;shot.kind='enemy';shot.isFriendly=false;shot.glow=this.add.circle(enemy.x,enemy.y,11,enemy.color,0.16).setDepth(3.8);this.enemyShots.add(shot);
  }
  enemyShotHit(_player,shot){
    if(!shot.active)return;
    this.killProjectile(shot);
    if(this.elapsed<(this.playerShotShieldUntil||0))return;
    this.playerShotShieldUntil=this.elapsed+150;this.playerHp-=shot.damage;this.damageFeedback(-shot.damage);this.cameras.main.shake(95,0.003);
    if(this.playerHp<=0)this.finishRun();
  }
  contactEnemy(enemy){if(!enemy.alive||this.elapsed<(this.invulnerableUntil||0))return;this.playerHp-=5;this.invulnerableUntil=this.elapsed+600;const a=Phaser.Math.Angle.Between(enemy.x,enemy.y,this.player.x,this.player.y);this.player.body.setVelocity(Math.cos(a)*220,Math.sin(a)*220);this.damageFeedback(-5);this.cameras.main.shake(110,0.004);if(this.playerHp<=0)this.finishRun();}

  damageEnemy(enemy,amount,color,opts={}){
    if(!enemy?.alive)return;enemy.hp-=amount;enemy.score=Math.max(0,enemy.score+Math.round(amount/3));this.damageText(enemy.x,enemy.y,`-${amount}`,color);this.particle(enemy.x,enemy.y,color,8);audioFX.impact();
    if(opts.slow)enemy.slowUntil=this.elapsed+opts.slow;
    if(opts.freeze)enemy.slowUntil=this.elapsed+opts.freeze;
    if(opts.knockback){const a=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);enemy.body.setVelocity(Math.cos(a)*opts.knockback,Math.sin(a)*opts.knockback);}
    if(enemy.hp<=0){enemy.alive=false;enemy.body.enable=false;enemy.setVisible(false);enemy.label.setVisible(false);enemy.hpGraphics.setVisible(false);enemy.score+=40;this.kills++;this.score+=50;this.particle(enemy.x,enemy.y,enemy.color,24);this.cameras.main.shake(145,0.005);this.spawnOrb(enemy.x,enemy.y);this.updateHud();if(this.enemies.every(e=>!e.alive))this.finishRun();}
  }

  impactArea(x,y,radius,damage,color,opts={}){
    this.particle(x,y,color,22);this.cameras.main.shake(130,0.004);
    const ring=this.add.circle(x,y,12,color,0.08).setStrokeStyle(3,color,0.95).setDepth(10);this.tweens.add({targets:ring,scale:radius/12,alpha:0,duration:400,ease:'Cubic.easeOut',onComplete:()=>ring.destroy()});
    for(const enemy of this.enemies){if(enemy.alive&&Phaser.Math.Distance.Between(x,y,enemy.x,enemy.y)<radius){this.damageEnemy(enemy,damage,color,opts);}}
  }
  coneAttack(angle,range,halfAngle,damage,color,knockback){
    this.fxGraphics.clear();this.fxGraphics.fillStyle(color,0.12);this.fxGraphics.lineStyle(2,color,0.8);
    const points=[];for(let i=0;i<=18;i++){const a=angle-halfAngle+(i/18)*halfAngle*2;points.push(new Phaser.Math.Vector2(this.player.x+Math.cos(a)*range,this.player.y+Math.sin(a)*range));}
    for(let i=18;i>=0;i--){const a=angle-halfAngle+(i/18)*halfAngle*2;points.push(new Phaser.Math.Vector2(this.player.x+Math.cos(a)*(range-46),this.player.y+Math.sin(a)*(range-46)));}
    this.fxGraphics.fillPoints(points,true);this.fxGraphics.strokePoints(points,true);this.time.delayedCall(260,()=>this.fxGraphics.clear());
    for(const enemy of this.enemies){if(!enemy.alive)continue;const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,enemy.x,enemy.y),a=Phaser.Math.Angle.Between(this.player.x,this.player.y,enemy.x,enemy.y);if(d<range&&Math.abs(Phaser.Math.Angle.Wrap(a-angle))<halfAngle)this.damageEnemy(enemy,damage,color,{knockback});}
  }

  pointLineDist(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,t=clamp(((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));}
  killProjectile(shot){if(shot?.active){shot.body?.stop();shot.glow?.destroy();shot.destroy();}}
  particle(x,y,color,count=7){for(let i=0;i<count;i++){const dot=this.add.circle(x,y,Phaser.Math.FloatBetween(1.5,3.5),color,0.9).setDepth(10);const a=Math.random()*Math.PI*2,d=Phaser.Math.Between(18,72);this.tweens.add({targets:dot,x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,alpha:0,scale:0,duration:Phaser.Math.Between(220,540),onComplete:()=>dot.destroy()});}}
  damageText(x,y,text,color){const label=this.add.text(x,y,text,{fontFamily:'Barlow Condensed',fontSize:'19px',fontStyle:'bold',color:'#'+color.toString(16).padStart(6,'0'),stroke:'#08101a',strokeThickness:4}).setOrigin(.5).setDepth(14);this.tweens.add({targets:label,y:y-48,alpha:0,duration:760,onComplete:()=>label.destroy()});}
  damageFeedback(amount){this.damageText(this.player.x,this.player.y-20,String(amount),0xff7285);}
  spawnOrb(x,y){const orb=this.add.circle(x,y,8,0xffdf77,1).setStrokeStyle(2,0xfff8d4).setDepth(3);this.physics.add.existing(orb,true);orb.body.setCircle(10);orb.phase=Math.random()*7;this.orbs.add(orb);this.tweens.add({targets:orb,scale:1.2,duration:600,yoyo:true,repeat:-1});}
  collectOrb(orb){if(!orb.active)return;orb.destroy();this.playerHp=Math.min(100,this.playerHp+15);this.score+=10;this.damageText(this.player.x,this.player.y-28,'+15 HP  +10',0xffdf77);this.particle(this.player.x,this.player.y,0xffdf77,14);this.updateHud();}

  fuseCards(from,to){
    if(from===to||!this.hand[from]||!this.hand[to])return;
    const {fuseCards}=this.constructor.spells||{};
    const card=fuseCards?fuseCards(this.hand[from],this.hand[to]):this.fusionLookup(this.hand[from],this.hand[to]);
    this.hand[to]=card;this.hand[from]=null;this.cooldowns.add(from);this.cooldowns.add(to);audioFX.fuse();
    this.time.delayedCall(1200,()=>{if(!this.gameLive)return;this.hand[from]=Phaser.Utils.Array.GetRandom(['fireball','frost','volt','blink','nova']);this.cooldowns.delete(from);this.cooldowns.delete(to);this.game.events.emit('arena:hand',this.hand.slice());});
    this.game.events.emit('arena:hand',this.hand.slice());this.game.events.emit('arena:toast',{text:`${SPELLS[card].name.toUpperCase()} FUSED`,color:SPELLS[card].css});
  }
  fusionLookup(a,b){const k=[a,b].sort().join('+');return ({'fireball+volt':'plasma','fireball+frost':'thermal','blink+fireball':'meteor','nova+volt':'storm','blink+frost':'shadow'})[k]||'overdrive';}

  startCooldown(slot){this.hand[slot]=null;this.cooldowns.add(slot);this.game.events.emit('arena:hand',this.hand.slice());this.time.delayedCall(1200,()=>{if(!this.gameLive)return;this.hand[slot]=Phaser.Utils.Array.GetRandom(['fireball','frost','volt','blink','nova']);this.cooldowns.delete(slot);this.game.events.emit('arena:hand',this.hand.slice());});}
  useCard(slot,direction){if(!this.gameLive||this.cooldowns.has(slot)||!this.hand[slot])return;const card=this.hand[slot];this.startCooldown(slot);this.cast(card,direction);this.game.events.emit('arena:hand',this.hand.slice());}

  updateHud(){
    const hp=document.getElementById('hp-label'),fill=document.getElementById('hp-fill'),score=document.getElementById('score-label');
    if(hp)hp.textContent=`${Math.max(0,Math.ceil(this.playerHp))} / 100`;if(fill)fill.style.width=`${clamp(this.playerHp,0,100)}%`;if(score)score.textContent=String(this.score).padStart(4,'0');
    const list=document.getElementById('leader-list');if(list){const ranked=[{name:this.playerName,score:this.score,kills:this.kills,player:true},...this.enemies.filter(e=>e.alive).map(e=>({name:e.name,score:e.score,kills:e.kills,player:false}))].sort((a,b)=>b.score-a.score).slice(0,5);list.innerHTML=ranked.map((e,i)=>`<li><b>${i===0?'♛':String(i+1).padStart(2,'0')}</b><span>${e.player?'YOU · '+e.name:e.name}</span><span>${e.score}</span></li>`).join('');}
  }

  finishRun(){if(!this.gameLive)return;this.gameLive=false;this.clearAim();this.physics.world.pause();audioFX.defeat();this.game.events.emit('arena:over',{kills:this.kills,score:this.score,rank:this.getRank()});}
  getRank(){return 1+this.enemies.filter(e=>e.alive&&e.score>this.score).length;}
  returnHome(){this.gameLive=false;this.clearAim();this.physics.world.resume();this.scene.pause();this.game.events.emit('arena:home');}
}
