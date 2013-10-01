define(function(require, exports) {
	var CssLexer = require('./lexer/CssLexer'),
		CssRule = require('./lexer/rule/CssRule'),
		Token = require('./lexer/Token'),
		Parser = require('./parser/Parser'),
		Node = require('./parser/Node'),
		cleanCSS = require('clean-css'),
		sort = require('./util/sort'),
		index,
		head,
		body,
		plus;

	function getHead(node, ignore) {
		var leaves = node.leaves();
		leaves.forEach(function(leaf) {
			if([Node.FONTFACE, Node.MEDIA, Node.CHARSET, Node.IMPORT, Node.PAGE, Node.KEYFRAMES].indexOf(leaf.name()) > -1) {
				joinHead(leaf, ignore);
			}
		});
	}
	function joinHead(node, ignore) {
		var isToken = node.name() == Node.TOKEN;
		if(isToken) {
			var token = node.token();
			if(token.type() != Token.VIRTUAL) {
				head += token.content();
				while(ignore[++index]) {
					var ig = ignore[index];
					head += ig.content();
					delete ignore[index];
				}
			}
		}
		else {
			node.leaves().forEach(function(leaf, i) {
				joinHead(leaf, ignore);
			});
		}
	}
	var currentStyle;
	var currentValue;
	var currentHack;
	var currentImpt;
	function rebuild(node, ignore, arr) {
		var leaves = node.leaves();
		leaves.forEach(function(leaf) {
			if([Node.FONTFACE, Node.MEDIA, Node.CHARSET, Node.IMPORT, Node.PAGE, Node.KEYFRAMES].indexOf(leaf.name()) == -1) {
				rb(leaf, ignore, arr);
			}
		});
		//��ÿһ��ѡ����˳������
		arr.forEach(function(o) {
			sort(o.selectors);
		});
		return arr;
	}
	function rb(node, ignore, arr, isSelector, isValue) {
		var isToken = node.name() == Node.TOKEN;
		if(isToken) {
			var token = node.token();
			if(token.type() != Token.VIRTUAL) {
				if(isSelector) {
					currentSelector += token.content();
				}
				else if(isValue) {
					if(token.type() == Token.HACK) {
						currentHack = token.content();
					}
					else if(token.type() == Token.IMPORTANT) {
						currentImpt = true;
					}
					else {
						currentValue += token.content();
					}
				}
				while(ignore[++index]) {
					var ig = ignore[index];
					if(isSelector) {
						currentSelector += ig.content();
					}
					else if(isValue) {
						currentValue += ig.content();
					}
				}
			}
		}
		else {
			if(node.name() == Node.STYLESET) {
				arr.push({
					selectors: [],
					block: []
				});
			}
			else if(node.name() == Node.SELECTOR) {
				currentSelector = '';
				isSelector = true;
			}
			else if(node.name() == Node.KEY) {
				currentStyle = {
					key: node.leaves()[0].token().content()
				};
			}
			else if(node.name() == Node.VALUE) {
				currentValue = '';
				isValue = true;
				currentHack = null;
				currentImpt = null;
			}
			node.leaves().forEach(function(leaf) {
				rb(leaf, ignore, arr, isSelector, isValue);
			});
			if(node.name() == Node.SELECTOR) {
				arr[arr.length - 1].selectors.push(currentSelector);
			}
			else if(node.name() == Node.VALUE) {
				currentStyle.value = currentValue;
				currentStyle.hack = currentHack;
				currentStyle.impt = currentImpt;
				arr[arr.length - 1].block.push(currentStyle);
			}
		}
	}
	function merge(node) {
		var hash = {};
		for(var i = 0; i < node.length; i++) {
			var o = node[i];
			var s = o.selectors.join(',');
			if(hash[s]) {
				hash[s].block = hash[s].block.concat(o.block);
				node.splice(i, 1);
				i--;
			}
			else {
				hash[s] = o;
			}
		}
	}
	function duplicate(node) {
		node.forEach(function(o) {
			if(o.block.length > 1) {
				var hash = {};
				for(var i = 0; i < o.block.length; i++) {
					var style = o.block[i];
					//����ʽ��+hackΪ����ȥ��hack��Ӱ��
					var key = style.key;
					if(style.hack) {
						key += style.hack;
					}
					//û���������ȼ�Ϊ0����ͨ����Ϊ1��!importantΪ2��ɾ�������ȼ����ȳ��ֵ�
					var priority = style.impt ? 2 : 1;
					if(hash[key]) {
						if(priority >= hash[key].priority) {
							o.block.splice(hash[key].index, 1);
							i--;
							hash[key] = {
								index: i,
								priority: priority
							};
						}
						else {
							o.block.splice(i, 1);
							i--;
						}
					}
					else {
						hash[key] = {
							index: i,
							priority: priority
						}
					}
				}
			}
		});
		node.forEach(function(o) {
			if(o.block.length > 1) {
				var hash1 = {};
				var hash2 = {};
				//�Ӻ���ǰ������������ֵ������Ḳ�ǵ�ǰ��İ�����hack
				for(var i = o.block.length - 1; i >= 0; i--) {
					var style = o.block[i];
					//����ֵhack
					if(style.hack) {
						continue;
					}
					var k = style.key;
					if(k.indexOf('-webkit-') == 0) {
						k = k.slice(8);
					}
					else if(k.indexOf('-moz-') == 0) {
						k = k.slice(5);
					}
					else if(k.indexOf('-ms-') == 0) {
						k = k.slice(4);
					}
					else if(/^[*\-_]/.test(k)) {
						k = k.slice(1);
					}
					if(style.impt) {
						if(hash2[k]) {
							o.block.splice(i, 1);
						}
						else {
							hash2[k] = true;
						}
					}
					else {
						if(hash1[k]) {
							o.block.splice(i, 1);
						}
						else {
							hash1[k] = true;
						}
					}
				}
			}
		});
	}
	function override(node) {
		node.forEach(function(o) {
			if(o.block.length > 1) {
				//true��hash��ʶ��2�����ѳ��֣�3����important����
				var hash = {
					background: true,
					font: true,
					margin: true,
					padding: true,
					'list-style': true,
					overflow: true,
					border: true,
					'border-left': true,
					'border-top': true,
					'border-right': true,
					'border-bottom': true
				};
				//�Ӻ���ǰ������������ֵ��������Ḳ�ǵ�ǰ���������
				for(var i = o.block.length - 1; i >= 0; i--) {
					var style = o.block[i];
					//hack��Ҳ�ᱻ����
					var k = style.key;
					if(k.indexOf('-webkit-') == 0) {
						k = k.slice(8);
					}
					else if(k.indexOf('-moz-') == 0) {
						k = k.slice(5);
					}
					else if(k.indexOf('-ms-') == 0) {
						k = k.slice(4);
					}
					else if(/^[*\-_]/.test(k)) {
						k = k.slice(1);
					}
					if(hash[style.key] && !style.hack) {
						hash[style.key] = style.impt ? 3 : 2;
						continue;
					}
					switch(k) {
						case 'background-position':
						case 'background-color':
						case 'background-repeat':
						case 'background-attachment':
						case 'background-image':
							if(hash['background'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['background'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'font-style':
						case 'line-height':
						case 'font-family':
						case 'font-variant':
						case 'font-size':
							if(hash['font'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['font'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'margin-top':
						case 'margin-right':
						case 'margin-bottom':
						case 'margin-left':
							if(hash['margin'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['margin'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'padding-top':
						case 'padding-right':
						case 'padding-bottom':
						case 'padding-left':
							if(hash['padding'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['padding'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'list-style-image':
						case 'list-style-position':
						case 'list-style-type':
							if(hash['list-style'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['list-style'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'overflow-x':
						case 'overflow-y':
							if(hash['overflow'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['overflow'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'border-width':
						case 'border-color':
						case 'border-style':
							if(hash['border'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['border'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'border-left-width':
						case 'border-left-color':
						case 'border-left-style':
							if(hash['border-left'] == 3 || hash['border'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['border-left'] == 2 || hash['border'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'border-top-width':
						case 'border-top-color':
						case 'border-top-style':
							if(hash['border-top'] == 3 || hash['border'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['border-top'] == 2 || hash['border'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'border-right-width':
						case 'border-right-color':
						case 'border-right-style':
							if(hash['border-right'] == 3 || hash['border'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['border-right'] == 2 || hash['border'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
						case 'border-bottom-width':
						case 'border-bottom-color':
						case 'border-bottom-style':
							if(hash['border-bottom'] == 3 || hash['border'] == 3) {
								o.block.splice(i, 1);
							}
							else if(hash['border-bottom'] == 2 || hash['border'] == 2 && !style.impt) {
								o.block.splice(i, 1);
							}
						break;
					}
				}
			}
		});
	}
	function union(node) {
		var hash = {};
		for(var i = 0; i < node.length; i++) {
			var key = '';
			node[i].block.forEach(function(style, j) {
				key += style.key + ':' + style.value;
				if(style.hack) {
					key += style.hack;
				}
				if(style.impt) {
					key += '!important';
				}
				if(j < node[i].block.length - 1) {
					key += ';';
				}
			});
			hash[key] = hash[key] || [];
			hash[key].push(node[i]);
		}
		Object.keys(hash).forEach(function(o) {
			if(hash[o].length > 1) {
				//�����ѡ�����ϲ�����һ���ϣ�������ʶ��ʶ����
				hash[o].forEach(function(item, i) {
					if(i) {
						hash[o][0].selectors = hash[o][0].selectors.concat(item.selectors);
						item.union = true;
					}
				});
			}
		});
	}
	function extract(node) {
		var hash = {};
		node.forEach(function(o) {
			if(o.union) {
				return;
			}
			o.block.forEach(function(style) {
				var key = style.key + ':' + style.value;
				if(style.hack) {
					key += style.hack;
				}
				if(style.impt) {
					key += '!important';
				}
				hash[key] = hash[key] || [];
				hash[key].push({
					selectors: o.selectors,
					style: style
				});
			});
		});
		Object.keys(hash).forEach(function(o) {
			if(hash[o].length > 1) {
				hash[o].forEach(function(item, i) {
					//��joinʱ����
					item.style.extract = true;
					plus += item.selectors.join(',');
					if(i < hash[o].length - 1) {
						plus += ',';
					}
				});
				plus += '{';
				plus += o;
				plus += '}';
			}
		});
	}
	function join(node) {
		node.forEach(function(o) {
			if(o.union) {
				return;
			}
			//��ȡ�ϲ����ܻ���ֿյ����
			var num = 0;
			o.block.forEach(function(style) {
				if(style.extract) {
					num++;
				}
			});
			if(num == o.block.length) {
				return;
			}
			body += o.selectors.join(',');
			body += '{';
			o.block.forEach(function(style, i) {
				if(style.extract) {
					return;
				}
				body += style.key;
				body += ':';
				body += style.value;
				if(style.hack) {
					body += style.hack;
				}
				if(style.impt) {
					body += '!important';
				}
				if(i < o.block.length - 1) {
					body += ';';
				}
			});
			body += '}'
		});
	}
	function compress(src) {
		var node,
			ignore = {},
			lexer = new CssLexer(new CssRule()),
			parser = new Parser(lexer);
		try {
			lexer.parse(src);
			node = parser.program();
			ignore = parser.ignore();
		} catch(e) {
			if(console) {
				console.error(e);
			}
			return e.toString();
		}
		index = 0;
		head = '';
		body = '';
		plus = '';
		getHead(node, ignore);
		//��ast�ع��ɸ�ֱ�ӵ���ʽ����Ӹ�����Ϣ
		node = rebuild(node, ignore, []);
		//�ϲ���ͬѡ����
		merge(node);
		//ȥ��ͬһѡ�������ظ���ʽ����
		duplicate(node);
		//ȥ��ͬһѡ�����б����ǵ���ʽ����
		override(node);
		//�ۺ���ͬ��ʽ��ѡ����
		union(node);
		//��ȡͬ����
		//extract(node);
		//���
		join(node);
		return head + body + plus;
	}

	exports.compress = compress;
});